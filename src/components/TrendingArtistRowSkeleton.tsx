import { memo } from "react";
import {
  TableRow,
  TableCell,
} from "@/components/ui/table";

export const ArtistRowSkeleton = memo(() => (
  <TableRow className="hover:bg-transparent">
    <TableCell className="w-12">
      <div className="h-4 w-4 bg-white/10 rounded animate-pulse" />
    </TableCell>
    <TableCell>
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-white/10 animate-pulse" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-white/10 rounded w-32 animate-pulse" />
          <div className="h-3 bg-white/10 rounded w-24 animate-pulse" />
        </div>
      </div>
    </TableCell>
    <TableCell className="hidden md:table-cell">
      <div className="h-4 bg-white/10 rounded w-16 animate-pulse" />
    </TableCell>
    <TableCell>
      <div className="h-4 bg-white/10 rounded w-12 ml-auto animate-pulse" />
    </TableCell>
    <TableCell>
      <div className="h-4 bg-white/10 rounded w-16 ml-auto animate-pulse" />
    </TableCell>
  </TableRow>
));
ArtistRowSkeleton.displayName = 'ArtistRowSkeleton';

