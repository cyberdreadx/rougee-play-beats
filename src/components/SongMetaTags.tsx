import { Helmet } from 'react-helmet-async';

interface SongMetaTagsProps {
  title: string;
  artist: string;
  imageUrl?: string;
  url: string;
  description?: string;
  songId?: string;
}

export const SongMetaTags = ({ title, artist, imageUrl, url, description, songId }: SongMetaTagsProps) => {
  const metaTitle = `${title} by ${artist} | ROUGEE.PLAY`;
  const metaDescription = description || `Listen to ${title} by ${artist} on ROUGEE.PLAY - The decentralized music platform`;
  const defaultImage = `${window.location.origin}/og-image.png`;
  // Use provided image or default
  const metaImage = imageUrl || defaultImage;

  return (
    <Helmet>
      {/* Primary Meta Tags */}
      <title>{metaTitle}</title>
      <meta name="title" content={metaTitle} />
      <meta name="description" content={metaDescription} />

      {/* Open Graph / Facebook */}
      <meta property="og:type" content="music.song" />
      <meta property="og:url" content={url} />
      <meta property="og:title" content={metaTitle} />
      <meta property="og:description" content={metaDescription} />
      <meta property="og:image" content={metaImage} />
      <meta property="og:site_name" content="ROUGEE.PLAY" />
      <meta property="music:musician" content={artist} />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:url" content={url} />
      <meta name="twitter:title" content={metaTitle} />
      <meta name="twitter:description" content={metaDescription} />
      <meta name="twitter:image" content={metaImage} />
      <meta name="twitter:site" content="@rougeenetwork" />
    </Helmet>
  );
};
