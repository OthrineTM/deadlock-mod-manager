import { useVirtualizer } from "@tanstack/react-virtual";
import { type RefObject, useMemo } from "react";
import { useResponsiveColumns } from "@/hooks/use-responsive-columns";
import type { CatalogCollectionDto } from "@/types/generated/CatalogCollectionDto";
import { CollectionCard } from "./collection-card";

export const COLLECTION_GRID_CLASS =
  "grid grid-cols-2 gap-4 px-1 pr-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6";

// A 3:4 card at the widest column; rows are measured once they render.
const ROW_ESTIMATED_HEIGHT = 360;
const HEADING_ESTIMATED_HEIGHT = 40;

export type CollectionListSection = {
  title?: string;
  collections: CatalogCollectionDto[];
};

type ListRow =
  | { kind: "heading"; key: string; title: string }
  | { kind: "cards"; key: string; collections: CatalogCollectionDto[] };

/**
 * Renders only the rows near the viewport. The catalog lists hundreds of
 * collections with up to four thumbnails each, and mounting them all at once
 * freezes the webview, worst when WebKitGTK compositing is off (NVIDIA + Wayland
 * workaround) and everything is painted on the CPU.
 */
export const VirtualCollectionList = ({
  sections,
  scrollRef,
}: {
  sections: CollectionListSection[];
  scrollRef: RefObject<HTMLDivElement | null>;
}) => {
  // The grid never drops below two columns, unlike the mods grid.
  const columns = Math.max(2, useResponsiveColumns());
  const rows = useMemo(() => {
    const result: ListRow[] = [];
    for (const [sectionIndex, { title, collections }] of sections.entries()) {
      if (collections.length === 0) continue;
      if (title) {
        result.push({ kind: "heading", key: `heading-${sectionIndex}`, title });
      }
      for (let start = 0; start < collections.length; start += columns) {
        result.push({
          kind: "cards",
          key: `cards-${sectionIndex}-${start}`,
          collections: collections.slice(start, start + columns),
        });
      }
    }
    return result;
  }, [sections, columns]);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (index) =>
      rows[index]?.kind === "heading"
        ? HEADING_ESTIMATED_HEIGHT
        : ROW_ESTIMATED_HEIGHT,
    getItemKey: (index) => rows[index]?.key ?? index,
    overscan: 2,
  });

  return (
    <div
      style={{
        height: `${virtualizer.getTotalSize()}px`,
        position: "relative",
        width: "100%",
      }}>
      {virtualizer.getVirtualItems().map((virtualRow) => {
        const row = rows[virtualRow.index];
        if (!row) return null;
        return (
          <div
            className='absolute top-0 left-0 w-full pb-4'
            data-index={virtualRow.index}
            key={virtualRow.key}
            ref={virtualizer.measureElement}
            style={{ transform: `translateY(${virtualRow.start}px)` }}>
            {row.kind === "heading" ? (
              <h2
                className={
                  virtualRow.index === 0
                    ? "px-1 font-semibold text-lg"
                    : "px-1 pt-4 font-semibold text-lg"
                }>
                {row.title}
              </h2>
            ) : (
              <div className={COLLECTION_GRID_CLASS}>
                {row.collections.map((collection) => (
                  <CollectionCard collection={collection} key={collection.id} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
