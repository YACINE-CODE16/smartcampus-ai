import outputs from '../amplify_outputs.json';

/** Page d'accueil provisoire (phase 0) : vérifie que le front est relié au backend. */
export default function App() {
  const region = outputs.auth?.aws_region;

  return (
    <main className="home">
      <header className="home__brand">
        <img src="/favicon.svg" alt="" width={40} height={40} />
        <h1>SmartCampus AI</h1>
      </header>
      <p className="home__pitch">
        Signalez et suivez un incident du campus en moins de 2&nbsp;minutes.
      </p>
      <p className="home__status" role="status">
        {region ? `Backend Amplify connecté (${region})` : 'Backend Amplify non détecté'}
      </p>
      <p className="home__note">Connexion et espaces par rôle : phase 1.</p>
    </main>
  );
}
