import React, { useRef, useState } from 'react';
import { Upload, FileDown, X, File, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { storage } from '@/services/firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { DocumentFile } from '@/types';

interface MultiDocumentUploadProps {
  documents: DocumentFile[];
  onChange: (docs: DocumentFile[]) => void;
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
  onChange,
  readOnly = false,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const handleFileSelect = async (file: File) => {
    if (file.size > 50 * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: 'Please select a file smaller than 50MB.',
        variant: 'destructive',
      });
      return;
    }

    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (blockedExtensions.includes(ext)) {
      toast({
        title: 'File type not allowed',
        description: 'Executable files (.exe, .bat, .sh) are not allowed.',
        variant: 'destructive',
      });
      return;
    }
    if (!allowedExtensions.includes(ext)) {
      toast({
        title: 'File type not supported',
        description: 'Allowed types: PDF, DOCX, XLSX, JPG, PNG, MP4.',
        variant: 'destructive',
      });
      return;
    }

    setIsUploading(true);

    try {
      const uniqueFileName = `${Date.now()}_${file.name}`;
      const storageRef = ref(storage, `documents/${uniqueFileName}`);

      const uploadTask = uploadBytesResumable(storageRef, file);

      await new Promise<void>((resolve, reject) => {
        uploadTask.on(
          'state_changed',
          (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            setUploadProgress(Math.round(progress));
          },
          (error) => {
            console.error('Firebase upload error:', error);
            setIsUploading(false);
            toast({
              title: 'Upload failed',
              description: 'There was an error uploading your file.',
              variant: 'destructive',
            });
            reject(error);
          },
          async () => {
            try {
              const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
              const newDoc: DocumentFile = {
                name: file.name,
                size: file.size,
                type: file.type,
                data: downloadURL,
              };
              onChange([...documents, newDoc]);
              toast({
                title: 'Document uploaded',
                description: `"${file.name}" has been attached successfully.`,
              });
              resolve();
            } catch (urlError) {
              console.error('Error getting download URL:', urlError);
              toast({
                title: 'Upload failed',
                description: 'Failed to retrieve the file link.',
                variant: 'destructive',
              });
              reject(urlError);
            } finally {
              setIsUploading(false);
              setUploadProgress(0);
            }
          }
        );
      });
    } catch (error) {
      console.error('Upload initiation error:', error);
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      Array.from(files).forEach(file => handleFileSelect(file));
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDownload = (doc: DocumentFile) => {
    window.open(doc.data, '_blank');
  };

  const handleRemove = (index: number) => {
    const updated = documents.filter((_, i) => i !== index);
    onChange(updated);
    toast({
      title: 'Document removed',
      description: 'The document has been removed from the list.',
    });
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
                    onClick={() => handleRemove(index)}
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
