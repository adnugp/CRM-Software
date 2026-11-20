import React, { useRef, useState } from 'react';
import { Upload, FileDown, X, File, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { storage } from '@/services/firebase';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { DocumentFile } from '@/types';

interface MultiDocumentUploadProps {
  documents: DocumentFile[];
  /** Called with the files that finished uploading (the caller adds them to its record). */
  onAdd: (docs: DocumentFile[]) => void | Promise<void>;
  /** Called with the file to take off the record. */
  onRemove: (doc: DocumentFile) => void | Promise<void>;
  readOnly?: boolean;
}

const allowedExtensions = ['.pdf', '.docx', '.xlsx', '.jpg', '.jpeg', '.png', '.mp4'];
const blockedExtensions = ['.exe', '.bat', '.sh'];

const formatFileSize = (bytes: number) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const MultiDocumentUpload: React.FC<MultiDocumentUploadProps> = ({
  documents,
  onAdd,
  onRemove,
  readOnly = false,
}) => {
  const { workspaceId } = useWorkspace();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Why a file can't be uploaded, or null if it can.
  const problemWith = (file: File): string | null => {
    if (file.size > 50 * 1024 * 1024) return `"${file.name}" is larger than 50MB.`;
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (blockedExtensions.includes(ext)) return `"${file.name}": executable files (.exe, .bat, .sh) are not allowed.`;
    if (!allowedExtensions.includes(ext)) return `"${file.name}": allowed types are PDF, DOCX, XLSX, JPG, PNG, MP4.`;
    return null;
  };

  // Uploads one file and returns its record, or null if it failed. It doesn't
  // change the list itself: handleFiles adds all finished files at once.
  const uploadOne = (file: File, onProgress: (bytes: number) => void): Promise<DocumentFile | null> => {
    const storageRef = ref(storage, `workspaces/${workspaceId}/documents/${Date.now()}_${file.name}`);
    const uploadTask = uploadBytesResumable(storageRef, file);
    return new Promise((resolve) => {
      uploadTask.on(
        'state_changed',
        (snapshot) => onProgress(snapshot.bytesTransferred),
        (error) => {
          console.error('Firebase upload error:', error);
          resolve(null);
        },
        async () => {
          try {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            resolve({ name: file.name, size: file.size, type: file.type, data: downloadURL });
          } catch (urlError) {
            console.error('Error getting download URL:', urlError);
            resolve(null);
          }
        }
      );
    });
  };

  // Several files upload together and are added to the list in one change.
  // (Each used to add itself to an out-of-date copy of the list, so only the
  // last one to finish was kept.)
  const handleFiles = async (files: File[]) => {
    const accepted: File[] = [];
    for (const file of files) {
      const problem = problemWith(file);
      if (problem) toast({ title: 'File not added', description: problem, variant: 'destructive' });
      else accepted.push(file);
    }
    if (!accepted.length) return;

    setIsUploading(true);
    const total = accepted.reduce((sum, f) => sum + f.size, 0) || 1;
    const sent = accepted.map(() => 0);
    const results = await Promise.all(accepted.map((file, i) => uploadOne(file, (bytes) => {
      sent[i] = bytes;
      setUploadProgress(Math.round((sent.reduce((a, b) => a + b, 0) / total) * 100));
    })));
    setIsUploading(false);
    setUploadProgress(0);

    const uploaded = results.filter((d): d is DocumentFile => d !== null);
    const failed = accepted.filter((_, i) => results[i] === null).map(f => f.name);
    if (uploaded.length) {
      try {
        await onAdd(uploaded);
        toast({
          title: uploaded.length === 1 ? 'Document uploaded' : `${uploaded.length} documents uploaded`,
          description: uploaded.map(d => d.name).join(', '),
        });
      } catch (error) {
        console.error('Could not save the uploaded documents:', error);
        toast({ title: 'Not saved', description: 'The files uploaded but could not be added. Please try again.', variant: 'destructive' });
      }
    }
    if (failed.length) {
      toast({ title: 'Upload failed', description: `Could not upload: ${failed.join(', ')}`, variant: 'destructive' });
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    if (files.length) handleFiles(files);
  };

  const handleDownload = (doc: DocumentFile) => {
    window.open(doc.data, '_blank');
  };

  // Reports a change instead of a whole new list, so the caller can apply it
  // to the newest copy of its record (changeRecordList) without overwriting
  // anyone else's documents.
  const handleRemove = async (doc: DocumentFile) => {
    try {
      await onRemove(doc);
      toast({ title: 'Document removed', description: `"${doc.name}" has been removed.` });
    } catch (error) {
      console.error('Could not remove document:', error);
      toast({ title: 'Not removed', description: 'Please try again.', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-3">
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleInputChange}
        accept=".pdf,.docx,.xlsx,.jpg,.jpeg,.png,.mp4"
        multiple
        disabled={isUploading}
      />

      {documents.length > 0 && (
        <div className="space-y-2">
          {documents.map((doc, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-3 rounded-lg border bg-muted/30"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <File className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate max-w-[250px]">
                    {doc.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(doc.size)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button variant="ghost" size="sm" onClick={() => handleDownload(doc)}>
                  <FileDown className="h-4 w-4" />
                </Button>
                {!readOnly && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemove(doc)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {!readOnly && (
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
          >
            {isUploading ? (
              <>
                <span className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                Uploading... {uploadProgress}%
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Add Document
              </>
            )}
          </Button>
          {documents.length === 0 && (
            <p className="text-xs text-muted-foreground">No documents attached</p>
          )}
        </div>
      )}

      {!readOnly && documents.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Max file size: 50MB. Allowed: PDF, DOCX, XLSX, JPG, PNG, MP4.
        </p>
      )}
    </div>
  );
};

export default MultiDocumentUpload;
