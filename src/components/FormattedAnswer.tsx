import React from 'react';

/**
 * Renders a CRM answer as lightly-structured content: bullet rows with the item
 * name emphasised, section headers, "…and N more" hints and spacing — instead of
 * a raw pre-wrapped blob. The original plain text is kept intact upstream for
 * copy / download / share.
 */
export const FormattedAnswer: React.FC<{ text: string }> = ({ text }) => {
  const lines = text.split('\n');
  return (
    <div className="text-sm leading-relaxed space-y-1">
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={i} className="h-2" />;

        if (trimmed.startsWith('•')) {
          const body = trimmed.replace(/^•\s*/, '');
          const [name, ...rest] = body.split(' — ');
          return (
            <div key={i} className="flex gap-2">
              <span className="text-green-500 select-none leading-relaxed">•</span>
              <span>
                <span className="font-semibold text-gray-900">{name}</span>
                {rest.length > 0 && <span className="text-gray-600"> — {rest.join(' — ')}</span>}
              </span>
            </div>
          );
        }

        if (/^…and \d+ more/i.test(trimmed) || /^and \d+ more/i.test(trimmed)) {
          return <div key={i} className="text-xs italic text-gray-500 pl-5">{trimmed}</div>;
        }

        // "Projects (3):" style sub-headers
        if (/^[A-Za-z ]+\(\d+\):$/.test(trimmed)) {
          return <div key={i} className="font-semibold text-green-700 mt-1">{trimmed}</div>;
        }

        const isHeader =
          /:$/.test(trimmed) ||
          /^(Found|Here|Total|The |You have|No |I couldn|Needs attention|Hello)/.test(trimmed);
        return (
          <div key={i} className={isHeader ? 'font-semibold text-gray-900' : 'text-gray-700'}>
            {line}
          </div>
        );
      })}
    </div>
  );
};

export default FormattedAnswer;
