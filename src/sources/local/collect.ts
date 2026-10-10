import type { ImportItem } from './LocalSource';

/** Seleção por <input type="file"> (com ou sem webkitdirectory). */
export function itemsFromFileList(list: FileList | File[]): ImportItem[] {
  return [...list].map((file) => ({ file, relativePath: file.webkitRelativePath || file.name }));
}

/**
 * Drag-and-drop: percorre pastas soltas com `webkitGetAsEntry`, que existe nos quatro
 * navegadores-alvo. Gera o mesmo formato do input, então o resto do código é um caminho só.
 */
export async function itemsFromDataTransfer(dt: DataTransfer, limit = 5000): Promise<ImportItem[]> {
  const entries: FileSystemEntry[] = [];
  for (const item of [...dt.items]) {
    if (item.kind !== 'file') continue;
    const entry = item.webkitGetAsEntry?.();
    if (entry) entries.push(entry);
  }
  if (!entries.length) return itemsFromFileList(dt.files);

  const out: ImportItem[] = [];
  const walk = async (entry: FileSystemEntry, prefix: string): Promise<void> => {
    if (out.length >= limit) return;
    if (entry.isFile) {
      const file = await new Promise<File>((resolve, reject) => (entry as FileSystemFileEntry).file(resolve, reject));
      out.push({ file, relativePath: `${prefix}${file.name}` });
      return;
    }
    if (entry.isDirectory) {
      const reader = (entry as FileSystemDirectoryEntry).createReader();
      // readEntries devolve no máximo ~100 por chamada; repete até vir vazio.
      for (;;) {
        const batch = await new Promise<FileSystemEntry[]>((resolve, reject) => reader.readEntries(resolve, reject));
        if (!batch.length) break;
        for (const child of batch) await walk(child, `${prefix}${entry.name}/`);
      }
    }
  };
  for (const entry of entries) await walk(entry, '');
  return out;
}
