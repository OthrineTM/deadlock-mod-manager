import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@deadlock-mods/ui/components/empty";
import { SearchInput } from "@deadlock-mods/ui/components/search-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@deadlock-mods/ui/components/select";
import { Skeleton } from "@deadlock-mods/ui/components/skeleton";
import { Package } from "@deadlock-mods/ui/icons";
import { CardsThreeIcon, MagnifyingGlass } from "@phosphor-icons/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import Fuse from "fuse.js";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useSearchQueryState } from "@/hooks/use-search";
import { collectionsQueryOptions } from "@/lib/collections/queries";
import { usePersistedStore } from "@/lib/store";
import type { CatalogCollectionDto } from "@/types/generated/CatalogCollectionDto";
import HeroFilter from "@/components/mod-browsing/hero-filter";
import { CollectionCardSkeleton } from "./collection-card";
import {
  COLLECTION_GRID_CLASS,
  type CollectionListSection,
  VirtualCollectionList,
} from "./virtual-collection-list";

// Same fuzziness as the local mod search.
const COLLECTION_SEARCH_THRESHOLD = 0.35;

// Item-count ranges; collections under 10 items aren't listed at all.
const SIZE_RANGES = {
  any: [0, Infinity],
  small: [10, 24],
  medium: [25, 49],
  large: [50, 99],
  huge: [100, Infinity],
} as const;
type SizeRange = keyof typeof SIZE_RANGES;

export const CollectionGrid = () => {
  const { t } = useTranslation();
  const { data } = useSuspenseQuery(collectionsQueryOptions());
  const hideNSFW = usePersistedStore((state) => state.nsfwSettings.hideNSFW);
  const [size, setSize] = useState<SizeRange>("any");
  const [heroes, setHeroes] = useState<string[]>([]);
  const visible = useMemo(
    () => (hideNSFW ? data.filter((collection) => !collection.isNsfw) : data),
    [data, hideNSFW],
  );
  const collections = useMemo(() => {
    const [min, max] = SIZE_RANGES[size];
    const sized = visible.filter(
      ({ itemCount }) => itemCount >= min && itemCount <= max,
    );
    if (heroes.length === 0) return sized;
    // Collections built around a picked hero come before ones that merely include them.
    const heroRank = (collection: CatalogCollectionDto) =>
      Math.min(
        ...heroes.map((hero) => {
          const index = collection.heroes.indexOf(hero);
          return index === -1 ? Infinity : index;
        }),
      );
    return sized
      .map((collection) => ({ collection, rank: heroRank(collection) }))
      .filter(({ rank }) => rank !== Infinity)
      .sort((a, b) => a.rank - b.rank)
      .map(({ collection }) => collection);
  }, [visible, size, heroes]);
  // Shares the store's query with the other sections, so a search carries
  // over when switching tabs.
  const { query, setQuery } = useSearchQueryState();
  const debouncedQuery = useDebouncedValue(query, 300).trim();
  const fuse = useMemo(
    () =>
      new Fuse(collections, {
        keys: ["name", "description", "author"],
        threshold: COLLECTION_SEARCH_THRESHOLD,
      }),
    [collections],
  );

  const results = useMemo(
    () =>
      debouncedQuery
        ? fuse.search(debouncedQuery).map((result) => result.item)
        : null,
    [fuse, debouncedQuery],
  );
  const sections = useMemo((): CollectionListSection[] => {
    if (results) return [{ collections: results }];
    const featured = collections.filter((collection) => collection.isFeatured);
    return [
      { title: t("collections.featured"), collections: featured },
      {
        title: t("collections.all"),
        collections: collections.filter((collection) => !collection.isFeatured),
      },
    ];
  }, [results, collections, t]);
  const scrollRef = useRef<HTMLDivElement>(null);
  // A new search or filter starts from the top of the list.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [sections]);

  if (visible.length === 0) {
    return (
      <Empty className='py-12'>
        <EmptyHeader>
          <EmptyMedia variant='default'>
            <CardsThreeIcon className='h-16 w-16' />
          </EmptyMedia>
          <EmptyTitle>{t("collections.emptyTitle")}</EmptyTitle>
          <EmptyDescription>
            {t("collections.emptyDescription")}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className='flex min-h-0 flex-1 flex-col gap-4'>
      <div className='flex flex-wrap items-center gap-2'>
        <div className='min-w-48 max-w-sm flex-1'>
          <SearchInput
            className='w-full'
            id='search'
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("collections.searchPlaceholder")}
            value={query}
          />
        </div>
        <HeroFilter
          mods={[]}
          onHeroesChange={setHeroes}
          selectedHeroes={heroes}
        />
        <Select
          onValueChange={(value) => setSize(value as SizeRange)}
          value={size}>
          <SelectTrigger
            aria-label={t("collections.size.label")}
            className='w-fit gap-1'>
            <Package className='mr-1.5 h-4 w-4 text-muted-foreground' />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.keys(SIZE_RANGES).map((range) => (
              <SelectItem key={range} value={range}>
                {t(`collections.size.${range}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {(results ?? collections).length === 0 ? (
        <Empty className='py-12'>
          <EmptyHeader>
            <EmptyMedia variant='default'>
              <MagnifyingGlass className='h-16 w-16' />
            </EmptyMedia>
            <EmptyTitle>{t("collections.noResultsTitle")}</EmptyTitle>
            <EmptyDescription>
              {t("collections.noResultsDescription")}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className='min-h-0 flex-1 overflow-auto pb-24' ref={scrollRef}>
          <VirtualCollectionList scrollRef={scrollRef} sections={sections} />
        </div>
      )}
    </div>
  );
};

export const CollectionGridSkeleton = () => (
  <div className='flex min-h-0 flex-1 flex-col gap-4'>
    <Skeleton className='h-10 w-80' />
    <div className='min-h-0 flex-1 overflow-hidden'>
      <div className={COLLECTION_GRID_CLASS}>
        {Array.from({ length: 12 }, (_, index) => (
          <CollectionCardSkeleton key={index} />
        ))}
      </div>
    </div>
  </div>
);
