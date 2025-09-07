export const extractUsername = (email?: string) => {
  return (email || '').split('@')[0];
};

export const formatShortDateTime = (timestamp: number): string => {
  if (!timestamp) {
    return '';
  }

  const date = new Date(timestamp / 1000);

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0'); // months are 0-based
  const year = String(date.getFullYear());

  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `${day}/${month}/${year} ${hours}:${minutes}`;
};
