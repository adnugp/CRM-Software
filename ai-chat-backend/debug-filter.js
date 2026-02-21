
// Mock data mimicking the structure
const tenders = [
    { id: '1', name: 'Government Portal Development', company: 'Ministry of Technology', status: 'open' },
    { id: '2', name: 'Security Solutions', company: 'Dubai Police', status: 'open' },
    { id: '3', name: 'Social Media Marketing', company: 'Dubai Women Establishment', status: 'open' },
    { id: '4', name: 'Education Platform', company: 'Ministry of Education', status: 'open' },
    { id: '5', name: 'Some Other Tender', company: 'Unknown Co', status: 'open' }
];

// Fuzzy matching function (from server.js)
function fuzzyMatch(input, target, threshold = 0.6) {
    input = input.toLowerCase();
    target = target.toLowerCase();

    if (input === target) return 1.0;
    if (target.includes(input)) return 0.9;
    if (input.includes(target)) return 0.9;

    // Calculate Levenshtein distance
    const matrix = [];
    for (let i = 0; i <= target.length; i++) {
        matrix[i] = [i];
    }
    for (let j = 0; j <= input.length; j++) {
        matrix[0][j] = j;
    }

    for (let i = 1; i <= target.length; i++) {
        for (let j = 1; j <= input.length; j++) {
            if (target.charAt(i - 1) === input.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j] + 1
                );
            }
        }
    }

    const distance = matrix[target.length][input.length];
    const maxLength = Math.max(target.length, input.length);
    const similarity = 1 - (distance / maxLength);

    return similarity;
}

function findBestMatch(input, options, threshold = 0.6) {
    let bestMatch = null;
    let bestScore = 0;

    for (const option of options) {
        const score = fuzzyMatch(input, option);
        if (score > bestScore && score >= threshold) {
            bestScore = score;
            bestMatch = option;
        }
    }

    return { match: bestMatch, score: bestScore };
}

// Logic Simulation
async function test() {
    let lowerMessage = "open tenders for dubai municipality";
    let filteredTenders = [...tenders]; // Copy
    let filterDescription = "";

    // Status Logic
    const statusOptions = ['open', 'submitted', 'awarded', 'closed'];
    let statusMatch = null;
    if (lowerMessage.includes('open')) statusMatch = { match: 'open', score: 1.0 };

    if (statusMatch && statusMatch.match) {
        filteredTenders = filteredTenders.filter(t => t.status === statusMatch.match);
        filterDescription = statusMatch.match;
        console.log(`🎯 Status match: "open" -> "${statusMatch.match}"`);
    }

    // Company Logic
    const companies = [...new Set(tenders.map(t => t.company.toLowerCase()))];
    const messageWords = lowerMessage.split(' ');

    for (const word of messageWords) {
        if (word.length < 2) continue;
        const skipWords = ['the', 'and', 'or', 'but', 'for', 'with', 'how', 'many', 'what', 'where', 'when', 'who', 'why', 'all', 'show', 'get', 'list', 'find', 'tender', 'tenders'];
        if (skipWords.includes(word)) continue;

        console.log(`Testing word: "${word}"`);
        const companyMatch = findBestMatch(word, companies, 0.7);
        console.log(`  -> Match: ${companyMatch.match} (Score: ${companyMatch.score})`);

        if (companyMatch.match && companyMatch.score >= 0.7) {
            const actualCompany = companies.find(c => c === companyMatch.match);
            console.log(`  -> Applying filter for company: "${actualCompany}"`);
            filteredTenders = filteredTenders.filter(t => t.company.toLowerCase() === actualCompany);
            filterDescription = filterDescription ? `${filterDescription} tenders for ${actualCompany}` : `tenders for ${actualCompany}`;
            console.log(`  -> Result count: ${filteredTenders.length}`);
            break;
        }
    }

    console.log("\nFinal Results:", filteredTenders.map(t => `${t.name} (${t.company})`));
}

test();
