import React, { useRef, useState } from 'react';
import { Upload, FileDown, X, File, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { storage } from '@/services/firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';

interface DocumentUploadProps {
  document?: DocumentFile | null;
  onUpload: (doc: DocumentFile) => void;
  onRemove: () => void;
  readOnly?: boolean;
}

export interface DocumentFile {
  name: string;
  size: number;
  type: string;
  data: string; // Base64 encoded data
}

const DocumentUpload: React.FC<DocumentUploadProps> = ({
  document,
  onUpload,
  onRemove,
  readOnly = false,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const allowedExtensions = ['.pdf', '.docx', '.xlsx', '.jpg', '.jpeg', '.png', '.mp4'];
  const blockedExtensions = ['.exe', '.bat', '.sh'];

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
      // Create a unique filename to prevent overwriting
      const uniqueFileName = `${Date.now()}_${file.name}`;
      const storageRef = ref(storage, `documents/${uniqueFileName}`);
      
      const uploadTask = uploadBytesResumable(storageRef, file);

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
            description: 'There was an error uploading your file to Firebase.',
            variant: 'destructive',
          });
        },
        async () => {
          try {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            
            onUpload({
              name: file.name,
              size: file.size,
              type: file.type,
              data: downloadURL, // Store the Firebase URL
            });

            toast({
              title: 'Document uploaded',
              description: `"${file.name}" has been attached successfully.`,
            });
          } catch (urlError) {
            console.error('Error getting download URL:', urlError);
            toast({
              title: 'Upload failed',
              description: 'Failed to retrieve the file link.',
              variant: 'destructive',
            });
          } finally {
            setIsUploading(false);
            setUploadProgress(0);
          }
        }
      );
    } catch (error) {
      console.error('Upload initiation error:', error);
      setIsUploading(false);
      setUploadProgress(0);
      toast({
        title: 'Upload failed',
        description: 'Failed to start the upload process.',
        variant: 'destructive',
      });
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDownload = () => {
    if (!document) return;
    
    // Open the Firebase Storage URL in a new tab
    window.open(document.data, '_blank');
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (document) {
    return (
      <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <File className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground truncate max-w-[200px]">
              {document.name}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatFileSize(document.size)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={handleDownload}>
            <FileDown className="h-4 w-4" />
          </Button>
          {!readOnly && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onRemove}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (readOnly) {
    return (
      <p className="text-sm text-muted-foreground">No document attached</p>
    );
  }

  return (
    <div
      className={`relative border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
        isDragging
          ? 'border-primary bg-primary/5'
          : 'border-muted-foreground/25 hover:border-primary/50'
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleInputChange}
        accept=".pdf,.docx,.xlsx,.jpg,.jpeg,.png,.mp4"
        disabled={isUploading}
      />
      <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
      <p className="text-sm text-muted-foreground mb-2">
        Drag and drop a file here, or
      </p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => fileInputRef.current?.click()}
        disabled={isUploading}
      >
        {isUploading ? `Uploading... ${uploadProgress}%` : 'Browse Files'}
      </Button>
      
      {isUploading && (
        <div className="w-full bg-secondary rounded-full h-2.5 mt-4">
          <div 
            className="bg-primary h-2.5 rounded-full transition-all duration-300 ease-in-out" 
            style={{ width: `${uploadProgress}%` }}
          ></div>
        </div>
      )}

      <p className="text-xs text-muted-foreground mt-4">
        Max file size: 50MB
      </p>
    </div>
  );
};

export default DocumentUpload;
