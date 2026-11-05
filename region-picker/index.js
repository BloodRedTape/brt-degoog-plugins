const GLOBE_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#9aa0a6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15 15 0 0 1 0 20a15 15 0 0 1 0-20z"/></svg>';

export default {
  name: "Region picker",
  description:
    "Adds a region button to the search bar, so you can switch the search region without opening settings.",
  trigger: "region",
  isClientExposed: false,

  async execute() {
    return {
      title: "Region picker",
      html: '<div class="command-result"><p>Use the globe button in the search bar to choose a search region.</p></div>',
    };
  },

  searchBarActions: [
    {
      id: "picker",
      label: "",
      icon: `data:image/svg+xml,${encodeURIComponent(GLOBE_SVG)}`,
      type: "custom",
    },
  ],
};
