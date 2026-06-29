import { useRef, useState } from "react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Upload, X, FileText, CheckCircle2 } from "lucide-react";

export interface UploadedFile {
  name: string;
  base64: string;
  fileExtension: string;
}

const ALLOWED_EXTENSIONS = ["pdf", "jpg", "jpeg", "png", "doc", "docx"];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

interface Props {
  label: string;
  hint?: string;
  multiple?: boolean;
  files: UploadedFile[];
  onChange: (files: UploadedFile[]) => void;
  error?: string;
}

export function FileUpload({ label, hint, multiple = false, files, onChange, error }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setLocalError(null);

    const newFiles: UploadedFile[] = [];
    for (const file of Array.from(fileList)) {
      const ext = file.name.split(".").pop()?.toLowerCase() || "";
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        setLocalError(`${file.name}: unsupported file type (.${ext})`);
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        setLocalError(`${file.name}: file is too large (max 10MB)`);
        continue;
      }
      try {
        const base64 = await fileToBase64(file);
        newFiles.push({ name: file.name, base64, fileExtension: ext });
      } catch {
        setLocalError(`${file.name}: failed to read file`);
      }
    }

    if (newFiles.length > 0) {
      onChange(multiple ? [...files, ...newFiles] : newFiles);
    }
    if (inputRef.current) inputRef.current.value = "";
  };

  const removeFile = (index: number) => {
    onChange(files.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}

      <div
        className="rounded-xl border-2 border-dashed border-border bg-muted/30 p-4 text-center transition-colors hover:border-primary/50"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          handleFiles(e.dataTransfer.files);
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
          multiple={multiple}
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          className="gap-2"
        >
          <Upload className="h-4 w-4" />
          {files.length > 0 ? "Add another file" : "Choose file" + (multiple ? "s" : "")}
        </Button>
        <p className="mt-2 text-xs text-muted-foreground">
          PDF, JPG, PNG, DOC — max 10MB{multiple ? " each" : ""}
        </p>
      </div>

      {files.length > 0 && (
        <ul className="space-y-1.5">
          {files.map((f, i) => (
            <li
              key={i}
              className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-xs"
            >
              <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0 text-emerald-600" />
              <FileText className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
              <span className="flex-1 truncate">{f.name}</span>
              <button
                type="button"
                onClick={() => removeFile(i)}
                className="flex-shrink-0 text-muted-foreground hover:text-destructive"
                aria-label={`Remove ${f.name}`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {(error || localError) && (
        <p className="text-xs text-destructive">⚠ {error || localError}</p>
      )}
    </div>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Strip the "data:application/pdf;base64," prefix
      const base64 = result.split(",")[1] || "";
      resolve(base64);
    };
    reader.onerror = () => reject(new Error("File read error"));
    reader.readAsDataURL(file);
  });
}
