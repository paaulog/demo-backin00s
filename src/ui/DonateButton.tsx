import { config } from '../config';

/** RF18: link externo, abre em nova aba sem expor `window.opener`. */
export function DonateButton() {
  return (
    <a className="donate" href={config.donateUrl} target="_blank" rel="noopener noreferrer">
      Apoiar o projeto
    </a>
  );
}
