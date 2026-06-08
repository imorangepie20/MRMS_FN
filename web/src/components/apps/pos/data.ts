export type Category = "All" | "Coffee" | "Tea" | "Pastries" | "Snacks" | "Cold Drinks"

export type Product = {
  id: string
  name: string
  category: Exclude<Category, "All">
  price: number
  gradientFrom: string
  gradientTo: string
}

export const CATEGORIES: Category[] = ["All", "Coffee", "Tea", "Pastries", "Snacks", "Cold Drinks"]

export const PRODUCTS: Product[] = [
  {
    id: "p-01",
    name: "Espresso",
    category: "Coffee",
    price: 3.00,
    gradientFrom: "#4a2c2a",
    gradientTo: "#7c4a3a",
  },
  {
    id: "p-02",
    name: "Cappuccino",
    category: "Coffee",
    price: 4.50,
    gradientFrom: "#6b4226",
    gradientTo: "#c8956c",
  },
  {
    id: "p-03",
    name: "Latte",
    category: "Coffee",
    price: 4.75,
    gradientFrom: "#7d5a3c",
    gradientTo: "#d4a574",
  },
  {
    id: "p-04",
    name: "Americano",
    category: "Coffee",
    price: 3.50,
    gradientFrom: "#3d2b1f",
    gradientTo: "#6b4226",
  },
  {
    id: "p-05",
    name: "Green Tea",
    category: "Tea",
    price: 3.50,
    gradientFrom: "#2d5016",
    gradientTo: "#6aaa3a",
  },
  {
    id: "p-06",
    name: "Earl Grey",
    category: "Tea",
    price: 3.25,
    gradientFrom: "#3d1f4a",
    gradientTo: "#8b5e9a",
  },
  {
    id: "p-07",
    name: "Chamomile",
    category: "Tea",
    price: 3.00,
    gradientFrom: "#4a3a10",
    gradientTo: "#d4a017",
  },
  {
    id: "p-08",
    name: "Croissant",
    category: "Pastries",
    price: 3.25,
    gradientFrom: "#7a5c1e",
    gradientTo: "#e0b84a",
  },
  {
    id: "p-09",
    name: "Blueberry Muffin",
    category: "Pastries",
    price: 2.75,
    gradientFrom: "#2a2060",
    gradientTo: "#7b68ee",
  },
  {
    id: "p-10",
    name: "Cinnamon Roll",
    category: "Pastries",
    price: 3.75,
    gradientFrom: "#5c2e0a",
    gradientTo: "#c97a3a",
  },
  {
    id: "p-11",
    name: "Chocolate Cake",
    category: "Pastries",
    price: 4.25,
    gradientFrom: "#2d1810",
    gradientTo: "#6b3520",
  },
  {
    id: "p-12",
    name: "Granola Bar",
    category: "Snacks",
    price: 2.50,
    gradientFrom: "#5a4010",
    gradientTo: "#c8a04a",
  },
  {
    id: "p-13",
    name: "Mixed Nuts",
    category: "Snacks",
    price: 3.00,
    gradientFrom: "#3a2810",
    gradientTo: "#8b6830",
  },
  {
    id: "p-14",
    name: "Iced Coffee",
    category: "Cold Drinks",
    price: 4.00,
    gradientFrom: "#1a2a4a",
    gradientTo: "#4a7ab5",
  },
  {
    id: "p-15",
    name: "Lemonade",
    category: "Cold Drinks",
    price: 3.50,
    gradientFrom: "#4a4a10",
    gradientTo: "#e8e040",
  },
  {
    id: "p-16",
    name: "Iced Matcha",
    category: "Cold Drinks",
    price: 4.50,
    gradientFrom: "#1a3a1a",
    gradientTo: "#4a9a4a",
  },
]
