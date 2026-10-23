import { useI18n } from '../lib/i18n';

/**
 * Plaque de lieu, inspirée de la signalétique de porte : code du bâtiment + salle.
 * C'est l'élément graphique fort de l'interface (DESIGN.md, principe 1).
 */
export function LocationPlate({
  building,
  room,
  size = 'md',
}: {
  building: { code: string; name: string };
  room: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const { t } = useI18n();
  return (
    <span className={`plate plate--${size}`} title={`${building.name} — ${room}`}>
      <span className="sr-only">{t('Lieu : ', 'Location: ')}</span>
      <span className="plate__building">{building.code}</span>
      <span className="plate__room">{room}</span>
    </span>
  );
}
