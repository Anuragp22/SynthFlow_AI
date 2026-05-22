import { Music } from "lucide-react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getPresignedUrl } from "~/lib/s3";
import { getUserLikedSongs } from "~/actions/song";
import { SongCard } from "~/components/home/song-card";
import { auth } from "~/lib/auth";

export default async function FavoritesPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/auth/sign-in");
  }

  const likedSongs = await getUserLikedSongs();

  const songsWithUrls = await Promise.all(
    likedSongs.map(async (song) => {
      const thumbnailUrl = song.thumbnailS3Key
        ? await getPresignedUrl(song.thumbnailS3Key)
        : null;

      return { ...song, thumbnailUrl };
    }),
  );

  if (songsWithUrls.length === 0) {
    return (
      <div className="p-4">
        <h1 className="text-3xl font-bold tracking-tight">My Favorites</h1>
        <div className="mt-8 flex flex-col items-center justify-center py-12">
          <Music className="h-16 w-16 text-gray-400" />
          <h2 className="mt-4 text-xl font-semibold text-gray-900">
            No favorites yet
          </h2>
          <p className="mt-2 text-gray-500">
            Start liking songs to see them here
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      <h1 className="text-3xl font-bold tracking-tight">My Favorites</h1>
      <p className="mt-2 text-gray-600">
        {songsWithUrls.length} favorite song{songsWithUrls.length !== 1 ? "s" : ""}
      </p>

      <div className="mt-6">
        <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {songsWithUrls.map((song) => (
            <SongCard key={song.id} song={song} />
          ))}
        </div>
      </div>
    </div>
  );
}
