
'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, limit } from 'firebase/firestore';
import { COLLECTION_NAMES } from '@/lib/constants';
import { CartProvider, useCart } from '@/components/public/cart-context';
import { 
  ShoppingBag, 
  ChevronRight, 
  Plus, 
  Clock, 
  Info, 
  Search,
  ArrowRight,
  Loader2
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

export default function PublicOrderingPage() {
  const params = useParams();
  const slug = params.slug as string;
  const db = useFirestore();

  // Fetch Restaurant by Slug
  const restaurantQuery = useMemoFirebase(() => {
    if (!db || !slug) return null;
    return query(collection(db, COLLECTION_NAMES.RESTAURANTS), where('slug', '==', slug), limit(1));
  }, [db, slug]);
  const { data: restaurants, isLoading: isResLoading } = useCollection(restaurantQuery);
  const restaurant = restaurants?.[0];

  // Fetch Categories
  const categoriesQuery = useMemoFirebase(() => {
    if (!db || !restaurant?.id) return null;
    return query(collection(db, 'categories'), where('restaurantId', '==', restaurant.id), orderBy('order', 'asc'));
  }, [db, restaurant?.id]);
  const { data: categories } = useCollection(categoriesQuery);

  // Fetch Products
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
        {/* Sticky Header */}
        <header className="sticky top-0 z-40 w-full bg-background/80 backdrop-blur-md border-b px-4 h-16 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center font-black text-primary">
              {restaurant.name.charAt(0)}
            </div>
            <div>
              <h1 className="text-sm font-black uppercase italic leading-none">{restaurant.name}</h1>
              <div className="flex items-center gap-1 mt-1">
                <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-[10px] font-bold text-muted-foreground uppercase">Ouvert</span>
              </div>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="relative">
            <ShoppingBag className="h-6 w-6" />
            <CartBadge />
          </Button>
        </header>

        {/* Hero Section */}
        <section className="px-4 py-6 bg-secondary/20">
          <div className="flex flex-col gap-2">
            <p className="text-xs text-muted-foreground font-medium italic">Bienvenue chez {restaurant.name}</p>
            <h2 className="text-2xl font-black italic uppercase tracking-tighter leading-tight">
              Savourez l'instant, <br />
              <span className="text-primary">Commandez en ligne.</span>
            </h2>
            <div className="flex items-center gap-4 mt-2">
              <div className="flex items-center gap-1 text-[10px] font-bold bg-background px-2 py-1 rounded-full shadow-sm">
                <Clock className="h-3 w-3 text-primary" /> 25-35 min
              </div>
              <div className="flex items-center gap-1 text-[10px] font-bold bg-background px-2 py-1 rounded-full shadow-sm">
                <Info className="h-3 w-3 text-primary" /> Infos & Allergènes
              </div>
            </div>
          </div>
        </section>

        {/* Sticky Category Navigation */}
        <div className="sticky top-16 z-30 bg-background/95 border-b shadow-sm">
          <ScrollArea className="w-full whitespace-nowrap">
            <div className="flex p-3 gap-2">
              <Button 
                variant={activeCategory === null ? "default" : "ghost"} 
                size="sm" 
                className="rounded-full font-bold text-xs"
                onClick={() => setActiveCategory(null)}
              >
                Tout voir
              </Button>
              {categories?.map((cat) => (
                <Button 
                  key={cat.id}
                  variant={activeCategory === cat.id ? "default" : "ghost"} 
                  size="sm" 
                  className="rounded-full font-bold text-xs"
                  onClick={() => setActiveCategory(cat.id)}
                >
                  {cat.name}
                </Button>
              ))}
            </div>
            <ScrollBar orientation="horizontal" className="hidden" />
          </ScrollArea>
        </div>

        {/* Product Grid */}
        <main className="px-4 mt-6">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {products?.filter(p => !activeCategory || p.category === activeCategory).map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
          {isProdLoading && (
            <div className="grid grid-cols-2 gap-4 mt-4">
              {[1,2,3,4].map(i => <div key={i} className="h-48 bg-muted animate-pulse rounded-2xl" />)}
            </div>
          )}
        </main>

        {/* Sticky Bottom Cart Bar */}
        <CartBottomBar />
      </div>
    </CartProvider>
  );
}

function ProductCard({ product }: { product: any }) {
  const { addItem } = useCart();
  
  return (
    <Drawer>
      <DrawerTrigger asChild>
        <Card className="border-none shadow-md overflow-hidden rounded-2xl group active:scale-95 transition-all cursor-pointer">
          <div className="relative aspect-square bg-muted">
            <Image 
              src={product.imageUrl || `https://picsum.photos/seed/${product.id}/400/400`} 
              alt={product.name}
              fill
              className="object-cover group-hover:scale-110 transition-transform duration-500"
              sizes="(max-width: 768px) 50vw, 33vw"
            />
            {product.isDailySpecial && (
              <Badge className="absolute top-2 left-2 bg-primary text-[8px] font-black uppercase italic">Spécial</Badge>
            )}
          </div>
          <CardContent className="p-3">
            <h3 className="font-bold text-xs leading-tight line-clamp-2 h-8">{product.name}</h3>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-sm font-black text-primary italic">{product.price}€</span>
              <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <Plus className="h-4 w-4" />
              </div>
            </div>
          </CardContent>
        </Card>
      </DrawerTrigger>
      <DrawerContent className="rounded-t-3xl">
        <div className="relative aspect-video w-full">
           <Image 
              src={product.imageUrl || `https://picsum.photos/seed/${product.id}/400/400`} 
              alt={product.name}
              fill
              className="object-cover"
            />
        </div>
        <DrawerHeader className="p-6">
          <div className="flex justify-between items-start">
            <DrawerTitle className="text-2xl font-black italic uppercase tracking-tighter">{product.name}</DrawerTitle>
            <span className="text-2xl font-black text-primary italic">{product.price}€</span>
          </div>
          <DrawerDescription className="text-sm mt-2 leading-relaxed">
            {product.description || "Un délice préparé avec soin par nos chefs avec des ingrédients frais de saison."}
          </DrawerDescription>
        </DrawerHeader>
        <DrawerFooter className="p-6 pt-0">
          <Button className="h-14 text-lg font-black uppercase italic shadow-lg" onClick={() => addItem(product, 1)}>
            Ajouter au panier <Plus className="ml-2 h-5 w-5" />
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

function CartBadge() {
  const { totalItems } = useCart();
  if (totalItems === 0) return null;
  return (
    <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-[10px] font-black h-5 w-5 rounded-full flex items-center justify-center border-2 border-background">
      {totalItems}
    </span>
  );
}

function CartBottomBar() {
  const { totalItems, totalPrice } = useCart();
  if (totalItems === 0) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 p-4 z-50 animate-in slide-in-from-bottom-full duration-500">
      <div className="max-w-md mx-auto bg-primary text-primary-foreground p-4 rounded-2xl shadow-2xl flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-[10px] font-black uppercase opacity-80">{totalItems} ARTICLE{totalItems > 1 ? 'S' : ''}</span>
          <span className="text-xl font-black italic tracking-tighter">{totalPrice}€</span>
        </div>
        <Button variant="secondary" className="font-black italic uppercase h-12 px-8 rounded-xl shadow-inner group">
          Commander <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
        </Button>
      </div>
    </div>
  );
}
