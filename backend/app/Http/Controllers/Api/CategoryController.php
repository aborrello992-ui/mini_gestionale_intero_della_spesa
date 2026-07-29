<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Category;
use Illuminate\Http\Request;

class CategoryController extends Controller
{
    public function index()
    {
        return Category::orderBy('name')->get();
    }

    public function store(Request $request)
    {
        return response()->json(Category::create($request->validate([
            'name' => ['required', 'string', 'max:255', 'unique:categories,name'],
            'description' => ['nullable', 'string'],
            'is_active' => ['sometimes', 'boolean'],
        ])), 201);
    }

    public function update(Request $request, Category $category)
    {
        $category->update($request->validate([
            'name' => ['required', 'string', 'max:255', 'unique:categories,name,'.$category->id],
            'description' => ['nullable', 'string'],
            'is_active' => ['sometimes', 'boolean'],
        ]));

        return $category;
    }
}
