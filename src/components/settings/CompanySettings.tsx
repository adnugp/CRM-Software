import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Building2, ImagePlus, Loader2, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { storage } from '@/services/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { DIVISION_CODE, hexToHsl, newDivisionId, type Division } from '@/lib/workspace';
import { ProductLogo } from '@/components/brand/BrandMark';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

const DEFAULT_COLOR = '#16a34a'; // the default theme's green (src/index.css)
const MAX_LOGO_MB = 2;

/**
 * Settings → Company: the customer's own name, logo, brand colour and
 * divisions. Admins edit; managers see it read-only (firestore.rules only let
 * an admin of the workspace change it).
 */
const CompanySettings: React.FC = () => {
  const { user } = useAuth();
  const { workspace, workspaceId, updateWorkspace } = useWorkspace();
  const { projects, tenders, registrations, files } = useData();
  const { toast } = useToast();
  const canEdit = user?.role === 'admin';

  const [name, setName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [brandColor, setBrandColor] = useState('');
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  // Start from the saved settings (and again if they change elsewhere).
  useEffect(() => {
    setName(workspace?.name ?? '');
    setLogoUrl(workspace?.logoUrl ?? '');
    setBrandColor(workspace?.brandColor ?? '');
    setDivisions(workspace?.divisions ?? []);
  }, [workspace]);

  // How many records use each division; a division in use can't be deleted.
  const usage = useMemo(() => {
    const counts = new Map<string, number>();
    for (const record of [...projects, ...tenders, ...registrations, ...files]) {
      if (record.divisionId) counts.set(record.divisionId, (counts.get(record.divisionId) ?? 0) + 1);
    }
    return counts;
  }, [projects, tenders, registrations, files]);

  const problems = useMemo(() => {
    const list: string[] = [];
    if (!name.trim()) list.push('Company name is required.');
    if (brandColor && !hexToHsl(brandColor)) list.push('Brand colour must be a hex colour like #2563eb.');
    const codes = new Set<string>();
    divisions.forEach((d, i) => {
      const label = d.name.trim() || `Division ${i + 1}`;
      if (!d.name.trim()) list.push(`Division ${i + 1} needs a name.`);
      if (!DIVISION_CODE.test(d.code)) list.push(`${label}: code must be 2–4 capital letters (e.g. ENG).`);
      else if (codes.has(d.code)) list.push(`${label}: code ${d.code} is already used.`);
      codes.add(d.code);
    });
    return list;
  }, [name, brandColor, divisions]);

  const dirty = !!workspace && (
    name !== workspace.name ||
    logoUrl !== (workspace.logoUrl ?? '') ||
    brandColor !== (workspace.brandColor ?? '') ||
    JSON.stringify(divisions) !== JSON.stringify(workspace.divisions)
  );

  const updateDivision = (id: string, patch: Partial<Division>) =>
    setDivisions(prev => prev.map(d => (d.id === id ? { ...d, ...patch } : d)));

  const handleLogo = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/') || file.size > MAX_LOGO_MB * 1024 * 1024) {
      toast({ title: 'Logo not accepted', description: `Choose an image under ${MAX_LOGO_MB} MB (PNG, JPG or SVG).`, variant: 'destructive' });
      return;
    }
    setUploading(true);
    try {
      const extension = file.name.split('.').pop()?.toLowerCase() || 'png';
      const logoRef = ref(storage, `workspaces/${workspaceId}/branding/logo-${Date.now()}.${extension}`);
      await uploadBytes(logoRef, file, { contentType: file.type });
      setLogoUrl(await getDownloadURL(logoRef));
    } catch (error) {
      console.error('Logo upload failed:', error);
      toast({ title: 'Upload failed', description: 'The logo could not be uploaded. Please try again.', variant: 'destructive' });
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const handleSave = async () => {
    if (problems.length > 0) return;
    setSaving(true);
    try {
      await updateWorkspace({
        name: name.trim(),
        logoUrl,
        brandColor,
        divisions: divisions.map(d => ({ ...d, name: d.name.trim() })),
      });
      toast({ title: 'Company settings saved' });
    } catch (error) {
      console.error('Saving company settings failed:', error);
      toast({ title: 'Could not save', description: 'Your changes were not saved. Please try again.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (!workspace) return null;

  return (
    <Card className="overflow-hidden border-2 transition-all hover:border-primary/20">
      <CardHeader className="bg-muted/30">
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" />
          Company
        </CardTitle>
        <CardDescription>
          {canEdit
            ? 'Your company name, logo and colour appear across the app for everyone on your team.'
            : 'Only an administrator can change these settings.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8 p-6">
        {/* Identity */}
        <div className="grid gap-6 md:grid-cols-[auto_1fr]">
          <div className="flex flex-col items-center gap-2">
            <div className="flex h-20 w-20 items-center justify-center rounded-xl border bg-white p-1">
              {logoUrl ? <img src={logoUrl} alt="Company logo" className="max-h-full max-w-full object-contain" /> : <ProductLogo className="h-14 w-14" />}
            </div>
            {canEdit && (
              <div className="flex gap-1">
                <input ref={fileInput} type="file" accept="image/*" className="hidden" onChange={e => handleLogo(e.target.files?.[0])} />
                <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => fileInput.current?.click()}>
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                  <span className="ml-1">{logoUrl ? 'Change' : 'Upload'}</span>
                </Button>
                {logoUrl && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setLogoUrl('')} aria-label="Remove logo">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="company-name">Company name</Label>
              <Input id="company-name" value={name} disabled={!canEdit} onChange={e => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="brand-color">Brand colour</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  aria-label="Pick brand colour"
                  value={hexToHsl(brandColor) ? brandColor : DEFAULT_COLOR}
                  disabled={!canEdit}
                  onChange={e => setBrandColor(e.target.value)}
                  className="h-10 w-12 cursor-pointer rounded-md border bg-transparent p-1 disabled:cursor-not-allowed"
                />
                <Input
                  id="brand-color"
                  className="w-32 font-mono"
                  placeholder="Default"
                  value={brandColor}
                  disabled={!canEdit}
                  onChange={e => setBrandColor(e.target.value.trim())}
                />
                {canEdit && brandColor && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setBrandColor('')}>
                    <RotateCcw className="mr-1 h-4 w-4" /> Default
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">Applied to buttons, highlights and the sidebar after you save.</p>
            </div>
          </div>
        </div>

        {/* Divisions */}
        <div className="space-y-3">
          <div>
            <h3 className="font-semibold text-foreground">Divisions</h3>
            <p className="text-sm text-muted-foreground">
              Business units or brands inside your company. Projects, tenders, registrations and files can be
              tagged with one, and project numbers use its code (PRJ-ENG-001). Leave empty if you don't need them.
            </p>
          </div>

          {divisions.length > 0 && (
            <div className="space-y-2">
              <div className="hidden grid-cols-[1fr_7rem_6rem_2.5rem] gap-2 px-1 text-xs font-medium text-muted-foreground sm:grid">
                <span>Name</span><span>Code</span><span>Used by</span><span />
              </div>
              {divisions.map(d => {
                const used = usage.get(d.id) ?? 0;
                return (
                  <div key={d.id} className="grid grid-cols-[1fr_7rem] gap-2 sm:grid-cols-[1fr_7rem_6rem_2.5rem] sm:items-center">
                    <Input aria-label="Division name" placeholder="e.g. Energy" value={d.name} disabled={!canEdit}
                      onChange={e => updateDivision(d.id, { name: e.target.value })} />
                    <Input aria-label="Division code" placeholder="ENG" className="font-mono uppercase" maxLength={4} value={d.code} disabled={!canEdit}
                      onChange={e => updateDivision(d.id, { code: e.target.value.toUpperCase().replace(/[^A-Z]/g, '') })} />
                    <span className="text-sm text-muted-foreground">{used} record{used === 1 ? '' : 's'}</span>
                    {canEdit && (
                      <Button type="button" variant="ghost" size="icon" disabled={used > 0}
                        title={used > 0 ? 'In use: move those records to another division first' : 'Delete division'}
                        aria-label={`Delete ${d.name || 'division'}`}
                        onClick={() => setDivisions(prev => prev.filter(x => x.id !== d.id))}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {canEdit && (
            <Button type="button" variant="outline" size="sm"
              onClick={() => setDivisions(prev => [...prev, { id: newDivisionId(), name: '', code: '' }])}>
              <Plus className="mr-1 h-4 w-4" /> Add division
            </Button>
          )}
        </div>

        {canEdit && (
          <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
            <ul className="space-y-1 text-sm text-destructive">
              {dirty && problems.map(p => <li key={p}>{p}</li>)}
            </ul>
            <Button onClick={handleSave} disabled={!dirty || saving || uploading || problems.length > 0}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save company settings
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CompanySettings;
