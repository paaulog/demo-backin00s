import { useRef, useState, type DragEvent } from 'react';
import { importItems, loadDemoAlbum } from '../app/library';
import { itemsFromDataTransfer, itemsFromFileList } from '../sources/local/collect';
import { useApp } from '../store/store';

export function ImportPanel() {
  const importing = useApp((s) => s.importing);
  const warnings = useApp((s) => s.warnings);
  const [over, setOver] = useState(false);
  const folderInput = useRef<HTMLInputElement>(null);

  const onDrop = async (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    await importItems(await itemsFromDataTransfer(e.dataTransfer));
  };

  return (
    <section className="card" aria-labelledby="import-title">
      <h2 id="import-title">Seus CDs</h2>
      <div
        className={`dropzone${over ? ' over' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => void onDrop(e)}
        data-testid="dropzone"
      >
        <p style={{ margin: '0 0 10px' }}>Solte uma pasta de álbum aqui ou escolha abaixo. O áudio não sai do seu navegador.</p>
        <div className="row" style={{ justifyContent: 'center' }}>
          <label className="btn file-btn">
            Escolher pasta
            <input
              ref={folderInput}
              type="file"
              // webkitdirectory não está no tipo do React; os quatro navegadores-alvo aceitam.
              {...{ webkitdirectory: '', directory: '' }}
              multiple
              data-testid="folder-input"
              onChange={(e) => {
                if (e.target.files?.length) void importItems(itemsFromFileList(e.target.files));
                e.target.value = '';
              }}
            />
          </label>
          <label className="btn file-btn">
            Escolher arquivos
            <input
              type="file"
              multiple
              accept="audio/*,image/*,.flac,.m4a,.opus"
              data-testid="files-input"
              onChange={(e) => {
                if (e.target.files?.length) void importItems(itemsFromFileList(e.target.files));
                e.target.value = '';
              }}
            />
          </label>
          <button type="button" className="btn" onClick={() => void loadDemoAlbum()} data-testid="demo-album">
            Tocar o CD de demonstração
          </button>
        </div>
      </div>
      {importing && (
        <p className="progress" role="status">
          Lendo arquivos… {importing.done}/{importing.total}
        </p>
      )}
      {warnings.length > 0 && (
        <ul className="warnings" aria-live="polite">
          {warnings.map((w, i) => (
            <li key={i}>{w}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
