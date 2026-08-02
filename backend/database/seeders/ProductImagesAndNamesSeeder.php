<?php

namespace Database\Seeders;

use App\Models\Product;
use App\Support\NameNormalizer;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class ProductImagesAndNamesSeeder extends Seeder
{
    public function run(): void
    {
        $report = [];

        $croccante = Product::where('normalized_name', NameNormalizer::normalize('Croccante sandwich'))->first();
        if ($croccante) {
            $croccante->update([
                'name' => 'Gelato croccante alla gianduia',
                'image_alt' => 'Gelato croccante alla gianduia',
            ]);
            $report[] = ['file' => '-', 'product' => 'Gelato croccante alla gianduia', 'path' => '-', 'status' => 'rinominato'];
        }

        $root = dirname(base_path()).'/product-images';
        $mappings = [
            'bitter analcolico.webp' => 'Bitter',
            'patate al formaggio.webp' => 'Patatine al formaggio',
            'coca cola.webp' => 'Coca-Cola',
            'luke limone.webp' => 'Gelato Luke',
            'croccantelle.webp' => 'Croccantelle',
            'mini stecchini choc.webp' => 'Mini stecchino',
            'ghiaccioli .webp' => 'Ghiacciolo',
            'acqua eurospin.webp' => 'Acqua',
            'limonata in lattina.webp' => 'Limonata',
            'gelato croccante janduia.webp' => 'Gelato croccante alla gianduia',
            'best braun.webp' => 'Birra',
            'mini coni .webp' => 'Mini cono',
            'patate classiche .webp' => 'Patatine classiche',
            'biscochock .webp' => 'Biscochock',
            'biscotto .webp' => 'Biscotto bigusto',
            'the al limone.webp' => 'Tè al limone',
            'the alla pesca.webp' => 'Tè alla pesca',
            'chips.webp' => 'Chips',
        ];

        foreach ($mappings as $fileName => $productName) {
            $source = $root.'/'.$fileName;
            $product = Product::where('normalized_name', NameNormalizer::normalize($productName))->first();

            if (! File::exists($source)) {
                $report[] = ['file' => $fileName, 'product' => $productName, 'path' => '-', 'status' => 'file non trovato'];
                continue;
            }

            if (! $product) {
                $report[] = ['file' => $fileName, 'product' => $productName, 'path' => '-', 'status' => 'prodotto non trovato'];
                continue;
            }

            $extension = pathinfo($fileName, PATHINFO_EXTENSION);
            $safeName = Str::slug($product->name).'-'.substr(sha1_file($source), 0, 12).'.'.$extension;
            $destination = 'products/'.$safeName;

            if (! Storage::disk('public')->exists($destination)) {
                Storage::disk('public')->put($destination, File::get($source));
            }

            $product->update([
                'image_path' => $destination,
                'image_alt' => $product->name,
            ]);

            $report[] = ['file' => $fileName, 'product' => $product->name, 'path' => 'storage/'.$destination, 'status' => 'associata'];
        }

        $withoutImages = Product::query()
            ->where(fn ($query) => $query->whereNull('image_path')->orWhere('image_path', ''))
            ->orderBy('name')
            ->pluck('name')
            ->all();

        $this->command?->table(['file', 'product', 'path', 'status'], $report);
        $this->command?->warn('Prodotti senza immagine: '.implode(', ', $withoutImages));
    }
}
