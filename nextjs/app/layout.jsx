export const metadata={
  title:'Nordsweet Performance Calculator',
  description:'Planowanie lotu, osiągi, mapa, pogoda i komunikacja radiowa Nordsweet.',
  manifest:'/manifest.json',
  icons:{icon:'/icon-192.svg',apple:'/icon-192.svg'},
};
export const viewport={width:'device-width',initialScale:1,themeColor:'#0b1220'};
export default function RootLayout({children}){
  return <html lang="pl"><body>{children}</body></html>;
}
