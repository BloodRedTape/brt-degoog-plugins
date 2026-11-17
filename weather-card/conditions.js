const NS = "weather-card-slot";
const HAIL = 103;

const _parts = (code) => {
  const value = Number(code) || 0;
  return { value, sky: Math.floor(value / 100), amount: Math.floor(value / 10) % 10, type: value % 10 };
};

export const conditionIcon = (code) => {
  const { value, sky, amount, type } = _parts(code);
  if (value === HAIL) return { icon: "fa-cloud-rain", tone: "rain" };
  if (amount === 4) return { icon: "fa-cloud-bolt", tone: "bolt" };
  if (amount > 0 && type > 0) return { icon: "fa-snowflake", tone: "snow" };
  if (amount === 1) return { icon: "fa-droplet", tone: "rain" };
  if (amount > 1) return { icon: "fa-cloud-rain", tone: "rain" };
  if (sky <= 1) return { icon: "fa-sun", tone: "sun" };
  return { icon: "fa-cloud", tone: "cloud" };
};

export const conditionText = (code) => {
  const { value, sky, amount, type } = _parts(code);
  if (value === HAIL) return `{{ t:${NS}.hail }}`;
  const skyText = `{{ t:${NS}.sky.${Math.min(sky, 6)} }}`;
  return amount > 0 ? `${skyText}, {{ t:${NS}.precip.${amount}${Math.min(type, 2)} }}` : skyText;
};
