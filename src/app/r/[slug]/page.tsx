'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, limit } from 'firebase/firestore';
import { COLLECTION_NAMES } from '@/lib/constants';
import { CartProvider, useCart } from '@/components/public/cart-context';
import { 
  ShoppingBag, 
  Plus, 
  Minus,
  Clock, 
  Search,
  ArrowRight,
  Loader2,
  TrendingUp,
  ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { 
  Drawer, 
  DrawerContent, 
  DrawerHeader, 
  DrawerTitle, 
  DrawerDescription, 
  DrawerFooter,
  DrawerTrigger
} from '@/components/ui/drawer';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

export default function PublicOrderingPage() {
  const params = useParams();
  const slug = params.slug as string;
  const db = useFirestore();

  const restaurantQuery = useMemoFirebase(() => {
    if (!db || !slug) return null;
    return query(collection(db, COLLECTION_NAMES.RESTAURANTS), where('slug', '==', slug), limit(1));
  }, [db, slug]);
  const { data: restaurants, isLoading: isResLoading } = useCollection(restaurantQuery);
  const restaurant = restaurants?.[0];

  const categoriesQuery = useMemoFirebase(() => {
    if (!db || !restaurant?.id) return null;
    return query(collection(db, 'categories'), where('restaurantId', '==', restaurant.id), orderBy('order', 'asc'));
  }, [db, restaurant?.id]);
  const { data: categories } = useCollection(categoriesQuery);

  const productsQuery = useMemoFirebase(() => {
    if (!db || !restaurant?.id) return null;
    return query(collection(db, COLLECTION_NAMES.PRODUCTS), where('restaurantId', '==', restaurant.id));
  }, [db, restaurant?.id]);
  const { data: products, isLoading: isProdLoading } = useCollection(productsQuery);

  const [activeCategory, setActiveCategory] = React.useState<string | null>(null);

  if (isResLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>;
  if (!restaurant) return <div className="min-h-screen flex items-center justify-center font-bold">Établissement non trouvé</div>;

  return (
    <CartProvider>
      <div className="min-h-screen bg-background pb-32">
        <header className="sticky top-0 z-40 w-full bg-background/80 backdrop-blur-md border-b px-4 h-16 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center font-black text-primary overflow-hidden">
              {restaurant.logoUrl ? (
                <Image src={restaurant.logoUrl} alt={restaurant.name} width={40} height={40} className="object-cover" />
              ) : restaurant.name.charAt(0)}
            </div>
            <div>
              <h1 className="text-sm font-black uppercase italic leading-none">{restaurant.name}</h1>
              <div className="flex items-center gap-1 mt-1">
                <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-tight">Cuisine Ouverte</span>
              </div>
            </div>
          </div>
          <CartButton />
        </header>

        <section className="px-4 py-4 bg-primary/5">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 text-[10px] font-black uppercase text-primary tracking-widest">
              <TrendingUp className="h-3 w-3" /> Les plus demandés
            </div>
            <h2 className="text-xl font-black italic uppercase tracking-tighter leading-tight">
              Savourez <span className="text-primary">L'Excellence</span>
            </h2>
          </div>
        </section>

        <div className="sticky top-16 z-30 bg-background/95 border-b shadow-sm">
          <ScrollArea className="w-full whitespace-nowrap">
            <div className="flex p-3 gap-2">
              <Button 
                variant={activeCategory === null ? "default" : "secondary"} 
                size="sm" 
                className={cn("rounded-full font-bold text-[11px] h-8", activeCategory === null && "bg-primary")}
                onClick={() => setActiveCategory(null)}
              >
                Tout voir
              </Button>
              {categories?.map((cat) => (
                <Button 
                  key={cat.id}
                  variant={activeCategory === cat.id ? "default" : "secondary"} 
                  size="sm" 
                  className={cn("rounded-full font-bold text-[11px] h-8", activeCategory === cat.id && "bg-primary")}
                  onClick={() => setActiveCategory(cat.id)}
                >
                  {cat.name}
                </Button>
              ))}
            </div>
            <ScrollBar orientation="horizontal" className="hidden" />
          </ScrollArea>
        </div>

        <main className="px-4 mt-6">
          <div className="grid grid-cols-2 gap-3">
            {isProdLoading ? (
              [1,2,3,4].map(i => <Skeleton key={i} className="h-48 w-full rounded-2xl" />)
            ) : products?.filter(p => !activeCategory || p.category === activeCategory).map((product) => (
              <ProductCard key={product.id} product={product} currency={restaurant.currency} />
            ))}
          </div>
        </main>

        <CartBottomBar slug={slug} currency={restaurant.currency} />
      </div>
    </CartProvider>
  );
}

function ProductCard({ product, currency }: { product: any, currency: string }) {
  const { addItem, items, updateQuantity } = useCart();
  const cartItem = items.find(i => i.id === product.id);
  
  return (
    <Card className="border-none shadow-sm overflow-hidden rounded-2xl group active:scale-95 transition-all bg-card border border-primary/5">
      <Drawer>
        <DrawerTrigger asChild>
          <div className="relative aspect-square bg-muted cursor-pointer overflow-hidden">
            <Image 
              src={product.imageUrl || `https://picsum.photos/seed/${product.id}/400/400`} 
              alt={product.name}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 50vw, 33vw"
            />
            {product.isDailySpecial && (
              <Badge className="absolute top-2 left-2 bg-primary text-[8px] font-black uppercase italic shadow-lg">Spécial</Badge>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
          </div>
        </DrawerTrigger>
        <DrawerContent className="rounded-t-[2.5rem] p-0 overflow-hidden">
          <div className="relative aspect-video w-full">
             <Image 
                src={product.imageUrl || `https://picsum.photos/seed/${product.id}/600/400`} 
                alt={product.name}
                fill
                className="object-cover"
              />
          </div>
          <DrawerHeader className="px-6 py-6">
            <div className="flex justify-between items-start mb-2">
              <DrawerTitle className="text-2xl font-black italic uppercase tracking-tighter leading-none">{product.name}</DrawerTitle>
              <span className="text-2xl font-black text-primary italic leading-none">{product.price}{currency}</span>
            </div>
            <DrawerDescription className="text-sm leading-relaxed text-muted-foreground mt-2">
              {product.description || "Un délice signature préparé avec les meilleurs ingrédients locaux."}
            </DrawerDescription>
          </DrawerHeader>
          <DrawerFooter className="px-6 pb-10">
            <Button 
              className="h-14 text-lg font-black uppercase italic shadow-2xl rounded-2xl" 
              onClick={() => addItem(product, 1)}
            >
              Ajouter au panier <Plus className="ml-2 h-5 w-5" />
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      <CardContent className="p-3">
        <h3 className="font-bold text-[11px] leading-tight line-clamp-2 h-7">{product.name}</h3>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-[13px] font-black text-primary italic leading-none">{product.price}{currency}</span>
          
          {cartItem ? (
            <div className="flex items-center gap-2 bg-primary/10 rounded-full px-1 py-1">
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-6 w-6 rounded-full bg-primary text-white" 
                onClick={() => updateQuantity(product.id, cartItem.quantity - 1)}
              >
                <Minus className="h-3 w-3" />
              </Button>
              <span className="text-xs font-black text-primary">{cartItem.quantity}</span>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-6 w-6 rounded-full bg-primary text-white" 
                onClick={() => updateQuantity(product.id, cartItem.quantity + 1)}
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <Button 
              variant="secondary" 
              size="icon" 
              className="h-7 w-7 rounded-full bg-primary/10 text-primary hover:bg-primary hover:text-white transition-colors"
              onClick={() => addItem(product, 1)}
            >
              <Plus className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function CartButton() {
  const { totalItems } = useCart();
  return (
    <Button variant="ghost" size="icon" className="relative h-10 w-10 bg-secondary/50 rounded-xl">
      <ShoppingBag className="h-5 w-5 text-primary" />
      {totalItems > 0 && (
        <span className="absolute -top-1 -right-1 bg-primary text-white text-[9px] font-black h-4 w-4 rounded-full flex items-center justify-center border-2 border-background animate-in zoom-in">
          {totalItems}
        </span>
      )}
    </Button>
  );
}

function CartBottomBar({ slug, currency }: { slug: string, currency: string }) {
  const { totalItems, totalPrice } = useCart();
  const router = useRouter();

  if (totalItems === 0) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 p-4 z-50 animate-in slide-in-from-bottom-full duration-500">
      <div 
        className="max-w-md mx-auto bg-primary text-white p-4 rounded-3xl shadow-[0_20px_50px_rgba(249,115,22,0.4)] flex items-center justify-between cursor-pointer active:scale-[0.98] transition-all"
        onClick={() => router.push(`/r/${slug}/checkout`)}
      >
        <div className="flex flex-col">
          <span className="text-[9px] font-black uppercase opacity-80 tracking-widest">{totalItems} ARTICLE{totalItems > 1 ? 'S' : ''}</span>
          <span className="text-xl font-black italic tracking-tighter">{totalPrice}{currency}</span>
        </div>
        <div className="flex items-center gap-2 bg-white/20 px-6 py-3 rounded-2xl font-black italic uppercase text-xs">
          Commander <ChevronRight className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}
