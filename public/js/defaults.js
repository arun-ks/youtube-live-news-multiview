export const DEFAULT_COLLECTIONS = [
  {
    id: 'international',
    name: 'International News',
    feeds: [
      ['BBC News', 'https://www.youtube.com/@BBCNews'],
      ['Sky News', 'https://www.youtube.com/@SkyNews'],
      ['Al Jazeera English', 'https://www.youtube.com/@aljazeeraenglish'],
      ['DW News', 'https://www.youtube.com/@dwnews'],
      ['France 24 English', 'https://www.youtube.com/@France24_en'],
      ['CNA', 'https://www.youtube.com/@channelnewsasia']
    ]
  },
  {
    id: 'india',
    name: 'India English/Hindi News',
    feeds: [
      ['NDTV', 'https://www.youtube.com/@NDTV'],
      ['India Today', 'https://www.youtube.com/@indiatoday'],
      ['CNN-News18', 'https://www.youtube.com/@cnnnews18'],
      ['WION', 'https://www.youtube.com/@WION'],
      ['Aaj Tak', 'https://www.youtube.com/@aajtak'],
      ['ABP News', 'https://www.youtube.com/@ABPNEWS']
    ]
  },
  {
    id: 'malayalam',
    name: 'Malayalam Language News',
    feeds: [
      ['Asianet News', 'https://www.youtube.com/@AsianetNews'],
      ['Manorama News', 'https://www.youtube.com/@manoramanews'],
      ['24 News Malayalam', 'https://www.youtube.com/@24NewsMalayalam'],
      ['Mathrubhumi News', 'https://www.youtube.com/@MathrubhumiNews'],
      ['MediaOne', 'https://www.youtube.com/@MediaoneTVLive'],
      ['News18 Kerala', 'https://www.youtube.com/@News18Kerala']
    ]
  }
];

export function collectionFeeds(collectionId) {
  const collection = DEFAULT_COLLECTIONS.find((item) => item.id === collectionId);
  return (collection?.feeds || []).map(([name, url], index) => ({
    id: crypto.randomUUID(), name, url, enabled: true, order: index
  }));
}
