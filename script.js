// URL de la API de Google Apps Script
const API_URL = "https://script.google.com/macros/s/AKfycbzga01aCz_eDmiJ439TBA9q6aAMGOTk3HA2kikX-IOxE_J8Z3MGDwFZLql6CN_l6lk/exec";
let products = []; // Almacena los productos cargados desde Google Sheets
let cart = []; // Almacena los productos en el carrito

// Cargar productos desde la API
async function loadProducts() {
  try {
    const response = await fetch(`${API_URL}?action=getProducts`);
    products = await response.json();
    displayProducts(products); // Mostrar productos en la página
    populateCategories(); // Poblar el filtro de categorías
  } catch (error) {
    console.error("Error al cargar productos:", error);
  }
}

// Mostrar productos en la página
function displayProducts(products) {
  const productsDiv = document.getElementById("products");
  productsDiv.innerHTML = ""; // Limpiar contenedor
  products.forEach(product => {
    if (product.stock > 0) { // Mostrar solo productos con stock
      const card = document.createElement("div");
      card.className = "product-card";
      card.innerHTML = `
        <img src="${product.image}" alt="${product.name}">
        <h3>${product.name}</h3>
        <p>${product.description}</p>
        <p>Precio: $${product.price}</p>
        <p class="tags">${product.tags}</p>
        <button onclick="addToCart('${product.id}')">Añadir al Carrito 🛒</button>
      `;
      productsDiv.appendChild(card);
    }
  });
}

// Poblar el filtro de categorías
function populateCategories() {
  const categories = [...new Set(products.map(p => p.category))];
  const select = document.getElementById("category-filter");
  select.innerHTML = '<option value="">Todas las categorías</option>'; // Reiniciar opciones
  categories.forEach(category => {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    select.appendChild(option);
  });
}

// Filtrar productos por búsqueda o categoría
document.getElementById("search").addEventListener("input", filterProducts);
document.getElementById("category-filter").addEventListener("change", filterProducts);

function filterProducts() {
  const search = document.getElementById("search").value.toLowerCase();
  const category = document.getElementById("category-filter").value;
  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search) &&
    (category === "" || p.category === category)
  );
  displayProducts(filtered);
}

// Añadir producto al carrito
function addToCart(productId) {
  const product = products.find(p => p.id === productId);
  const cartItem = cart.find(item => item.id === productId);
  if (cartItem) {
    cartItem.quantity++;
  } else {
    cart.push({ ...product, quantity: 1 });
  }
  updateCart();
}

// Actualizar la visualización del carrito
function updateCart() {
  const cartItems = document.getElementById("cart-items");
  const cartCounter = document.getElementById("cart-counter");
  cartItems.innerHTML = ""; // Limpiar contenedor
  let total = 0;
  cart.forEach(item => {
    total += item.price * item.quantity;
    const div = document.createElement("div");
    div.innerHTML = `
      ${item.name} - $${item.price} x ${item.quantity}
      <button onclick="removeFromCart('${item.id}')">Eliminar</button>
    `;
    cartItems.appendChild(div);
  });
  cartCounter.textContent = `🛒 Carrito: ${cart.reduce((sum, item) => sum + item.quantity, 0)}`;
  cartItems.innerHTML += `<p>Total: $${total.toFixed(2)}</p>`;
}

// Eliminar producto del carrito
function removeFromCart(productId) {
  cart = cart.filter(item => item.id !== productId);
  updateCart();
}

// Enviar pedido por WhatsApp
async function sendOrder() {
  const customerName = document.getElementById("customer-name").value;
  const delivery = document.getElementById("delivery-method").value;
  const payment = document.getElementById("payment-method").value;
  if (!customerName || cart.length === 0) {
    alert("Por favor, ingresa tu nombre y añade productos al carrito.");
    return;
  }

  const orderDetails = cart.map(item => `${item.name} - ${item.quantity} x $${item.price}`).join("\n");
  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const message = `Nuevo pedido de ${customerName}\n\n${orderDetails}\n\nTotal: $${total.toFixed(2)}\nEntrega: ${delivery}\nPago: ${payment}`;
  
  // Guardar pedido en Google Sheets
  try {
    const order = { customerName, items: cart };
    await fetch(`${API_URL}?action=saveOrder&order=${encodeURIComponent(JSON.stringify(order))}`);
    
    // Enviar a WhatsApp
    const whatsappUrl = `https://wa.me/+584245314252?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, "_blank");
    
    // Limpiar carrito
    cart = [];
    updateCart();
    document.getElementById("customer-name").value = "";
  } catch (error) {
    console.error("Error al enviar el pedido:", error);
    alert("Error al guardar el pedido. Por favor, intenta de nuevo.");
  }
}

// Cargar productos al iniciar la página
loadProducts();