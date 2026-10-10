/// <reference lib="webworker" />
import { parseBlob } from 'music-metadata';
import type { ParsedFile } from './grouping';
import { toParsedFile, type MetadataLike } from './tags';

export interface WorkerRequest {
  id: number;
  items: { fileIndex: number; file: File; relativePath: string }[];
}

export interface WorkerResponse {
  id: number;
  results: ParsedFile[];
}

declare const self: DedicatedWorkerGlobalScope;

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const { id, items } = event.data;
  const results: ParsedFile[] = [];
  const transfer: ArrayBuffer[] = [];
  for (const item of items) {
    const base = { fileIndex: item.fileIndex, name: item.file.name, relativePath: item.relativePath };
    try {
      const meta = (await parseBlob(item.file, { duration: false })) as unknown as MetadataLike;
      const parsed = toParsedFile(meta, base);
      // Copia cada imagem para um buffer próprio, que pode ser transferido sem cópia extra.
      parsed.pictures = parsed.pictures.map((p) => {
        const data = p.data.slice();
        transfer.push(data.buffer as ArrayBuffer);
        return { ...p, data };
      });
      results.push(parsed);
    } catch (error) {
      results.push({ ...base, pictures: [], error: error instanceof Error ? error.message.slice(0, 200) : 'erro ao ler' });
    }
  }
  const response: WorkerResponse = { id, results };
  self.postMessage(response, transfer);
};
