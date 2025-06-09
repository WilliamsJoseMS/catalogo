// Configuración de la aplicación
const CONFIG = {
  API_URL: "https://script.google.com/macros/s/AKfycbzkJgWRPMX2ZgAtKbp6ul7dhB743sshK2RNszye_qG32JJl0G1RuK9zFiAWEvFTp64T/exec",
  SHIPPING_COST: 5.00,
  LOW_STOCK_THRESHOLD: 5,
  WHATSAPP_NUMBER: "+584245314252",
  CURRENCY: "$"
};

// Estado de la aplicación
const STATE = {
  products: [],
  filteredProducts: [],
  cart: [],
  isLoading: true,
  isCartOpen: false
};

// Elementos del DOM
const DOM = {
  productsContainer: document.getElementById("products"),
  productsLoader: document.getElementById("products-loader"),
  noProducts: document.getElementById("no-products"),
  searchInput: document.getElementById("search"),
  categoryFilter: document.getElementById("category-filter"),
  priceFilter: document.getElementById("price-filter"),
  priceValue: document.getElementById("price-value"),
  cartCounter: document.getElementById("cart-count"),
  cartSidebar: document.getElementById("cart-sidebar"),
  cartOverlay: document.getElementById("cart-overlay"),
  cartItems: document.getElementById("cart-items"),
  subtotal: document.getElementById("subtotal"),
  shipping: document.getElementById("shipping"),
  total: document.getElementById("total"),
  checkoutForm: document.getElementById("checkout-form"),
  customerName: document.getElementById("customer-name"),
  customerPhone: document.getElementById("customer-phone"),
  deliveryMethod: document.getElementById("delivery-method"),
  paymentMethod: document.getElementById("payment-method"),
  closeCart: document.getElementById("close-cart"),
  notification: document.getElementById("notification")
};

// Inicializar la aplicación
async function init() {
  setupEventListeners();
  await loadProducts();
  updateCartCounter();
}

// Configurar event listeners
function setupEventListeners() {
  // Filtros
  DOM.searchInput.addEventListener("input", debounce(filterProducts, 300));
  DOM.categoryFilter.addEventListener("change", filterProducts);
  DOM.priceFilter.addEventListener("input", updatePriceFilter);
  DOM.priceFilter.addEventListener("change", filterProducts);
  
  // Carrito
  document.querySelector(".cart-counter").addEventListener("click", toggleCart);
  DOM.closeCart.addEventListener("click", closeCart);
  DOM.cartOverlay.addEventListener("click", closeCart);
  DOM.deliveryMethod.addEventListener("change", updateShipping);
  
  // Formulario
  DOM.checkoutForm.addEventListener("submit", handleCheckout);
}

// Función debounce para mejorar el rendimiento
function debounce(func, wait) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

// Cargar productos desde la API
async function loadProducts() {
  try {
    STATE.isLoading = true;
    showLoader();
    
    const response = await fetch(`${CONFIG.API_URL}?action=getProducts`);
    if (!response.ok) throw new Error("Error al cargar productos");
    
    STATE.products = await response.json();
    STATE.filteredProducts = [...STATE.products];
    
    populateCategories();
    updatePriceFilterRange();
    filterProducts();
  } catch (error) {
    console.error("Error:", error);
    showNotification("Error al cargar los productos", "error");
  } finally {
    STATE.isLoading = false;
    hideLoader();
  }
}

// Mostrar loader
function showLoader() {
  DOM.productsLoader.style.display = "flex";
  DOM.productsContainer.style.display = "none";
  DOM.noProducts.style.display = "none";
}

// Ocultar loader
function hideLoader() {
  DOM.productsLoader.style.display = "none";
  DOM.productsContainer.style.display = "grid";
}

// Poblar categorías en el filtro
function populateCategories() {
  const categories = [...new Set(STATE.products.map(p => p.category))];
  categories.sort();
  
  DOM.categoryFilter.innerHTML = '<option value="">Todas las categorías</option>';
  
  categories.forEach(category => {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    DOM.categoryFilter.appendChild(option);
  });
}

// Actualizar rango de precios
function updatePriceFilterRange() {
  if (STATE.products.length === 0) return;
  
  const maxPrice = Math.max(...STATE.products.map(p => p.price));
  DOM.priceFilter.max = Math.ceil(maxPrice / 10) * 10;
  DOM.priceFilter.value = DOM.priceFilter.max;
  updatePriceFilter();
}

// Actualizar valor del filtro de precio
function updatePriceFilter() {
  DOM.priceValue.textContent = `Hasta ${CONFIG.CURRENCY}${DOM.priceFilter.value}`;
}

// Filtrar productos
function filterProducts() {
  const searchTerm = DOM.searchInput.value.toLowerCase();
  const category = DOM.categoryFilter.value;
  const maxPrice = parseFloat(DOM.priceFilter.value);
  
  STATE.filteredProducts = STATE.products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm) || 
                         product.description.toLowerCase().includes(searchTerm) ||
                         product.tags.toLowerCase().includes(searchTerm);
    const matchesCategory = category === "" || product.category === category;
    const matchesPrice = product.price <= maxPrice;
    
    return matchesSearch && matchesCategory && matchesPrice;
  });
  
  renderProducts();
}

// Renderizar productos
function renderProducts() {
  DOM.productsContainer.innerHTML = "";
  
  if (STATE.filteredProducts.length === 0) {
    DOM.noProducts.style.display = "flex";
    return;
  }
  
  DOM.noProducts.style.display = "none";
  
  STATE.filteredProducts.forEach(product => {
    const productCard = createProductCard(product);
    DOM.productsContainer.appendChild(productCard);
  });
}

// Crear tarjeta de producto
function createProductCard(product) {
  const card = document.createElement("div");
  card.className = "product-card";
  
  // Determinar estado del stock
  let stockClass = "";
  let stockText = "";
  
  if (product.stock <= 0) {
    stockClass = "out-of-stock";
    stockText = "Agotado";
  } else if (product.stock <= CONFIG.LOW_STOCK_THRESHOLD) {
    stockClass = "low-stock";
    stockText = `Últimas ${product.stock} unidades`;
  } else {
    stockClass = "in-stock";
    stockText = "Disponible";
  }
  
  // Crear etiquetas (tags)
  const tags = product.tags.split(",").map(tag => tag.trim());
  const tagsHtml = tags.map(tag => `<span class="product-tag">${tag}</span>`).join("");
  
  card.innerHTML = `
    <div class="product-image">
      <img src="${product.image || 'https://via.placeholder.com/300x200?text=No+Image'}" alt="${product.name}">
      ${product.stock <= CONFIG.LOW_STOCK_THRESHOLD && product.stock > 0 ? `<span class="product-badge">¡Últimas unidades!</span>` : ''}
    </div>
    <div class="product-content">
      <h3 class="product-title">${product.name}</h3>
      <p class="product-description">${product.description}</p>
      <p class="product-price">${CONFIG.CURRENCY}${product.price.toFixed(2)}</p>
      <p class="product-stock ${stockClass}"><i class="fas fa-box"></i> ${stockText}</p>
      ${tags.length > 0 ? `<div class="product-tags">${tagsHtml}</div>` : ''}
      <button class="add-to-cart" onclick="addToCart('${product.id}')" ${product.stock <= 0 ? 'disabled' : ''}>
        <i class="fas fa-cart-plus"></i> ${product.stock <= 0 ? 'Agotado' : 'Añadir al carrito'}
      </button>
    </div>
  `;
  
  return card;
}

// Añadir producto al carrito
function addToCart(productId) {
  const product = STATE.products.find(p => p.id === productId);
  if (!product) return;
  
  // Verificar stock
  const cartItem = STATE.cart.find(item => item.id === productId);
  const quantityInCart = cartItem ? cartItem.quantity : 0;
  
  if (product.stock <= quantityInCart) {
    showNotification("No hay suficiente stock disponible", "error");
    return;
  }
  
  if (cartItem) {
    cartItem.quantity++;
  } else {
    STATE.cart.push({
      ...product,
      quantity: 1
    });
  }
  
  updateCart();
  showNotification(`${product.name} añadido al carrito`);
  
  // Abrir carrito si está cerrado
  if (!STATE.isCartOpen) {
    toggleCart();
  }
}

// Eliminar producto del carrito
function removeFromCart(productId) {
  STATE.cart = STATE.cart.filter(item => item.id !== productId);
  updateCart();
  showNotification("Producto eliminado del carrito");
}

// Actualizar cantidad en el carrito
function updateCartItemQuantity(productId, newQuantity) {
  const cartItem = STATE.cart.find(item => item.id === productId);
  if (!cartItem) return;
  
  const product = STATE.products.find(p => p.id === productId);
  
  // Validar stock máximo
  if (newQuantity > product.stock) {
    showNotification(`No hay suficiente stock. Máximo disponible: ${product.stock}`, "error");
    return false;
  }
  
  if (newQuantity < 1) {
    removeFromCart(productId);
    return false;
  }
  
  cartItem.quantity = newQuantity;
  updateCart();
  return true;
}

// Actualizar carrito
function updateCart() {
  // Actualizar contador
  updateCartCounter();
  
  // Actualizar items del carrito
  DOM.cartItems.innerHTML = "";
  
  if (STATE.cart.length === 0) {
    DOM.cartItems.innerHTML = `
      <div class="empty-cart">
        <i class="fas fa-shopping-basket"></i>
        <p>Tu carrito está vacío</p>
      </div>
    `;
    updateCartTotals();
    return;
  }
  
  STATE.cart.forEach(item => {
    const cartItem = document.createElement("div");
    cartItem.className = "cart-item";
    
    cartItem.innerHTML = `
      <div class="cart-item-image">
        <img src="${item.image || 'https://via.placeholder.com/100x100?text=No+Image'}" alt="${item.name}">
      </div>
      <div class="cart-item-details">
        <h4 class="cart-item-title">${item.name}</h4>
        <p class="cart-item-price">${CONFIG.CURRENCY}${item.price.toFixed(2)}</p>
        <div class="cart-item-quantity">
          <button class="quantity-btn" onclick="updateCartItemQuantity('${item.id}', ${item.quantity - 1})">-</button>
          <span>${item.quantity}</span>
          <button class="quantity-btn" onclick="updateCartItemQuantity('${item.id}', ${item.quantity + 1})">+</button>
        </div>
        <button class="remove-item" onclick="removeFromCart('${item.id}')">
          <i class="fas fa-trash-alt"></i> Eliminar
        </button>
      </div>
    `;
    
    DOM.cartItems.appendChild(cartItem);
  });
  
  updateCartTotals();
}

// Actualizar totales del carrito
function updateCartTotals() {
  const subtotal = STATE.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const shipping = DOM.deliveryMethod.value === "Domicilio" ? CONFIG.SHIPPING_COST : 0;
  const total = subtotal + shipping;
  
  DOM.subtotal.textContent = `${CONFIG.CURRENCY}${subtotal.toFixed(2)}`;
  DOM.shipping.textContent = `${CONFIG.CURRENCY}${shipping.toFixed(2)}`;
  DOM.total.textContent = `${CONFIG.CURRENCY}${total.toFixed(2)}`;
}

// Actualizar costo de envío
function updateShipping() {
  updateCartTotals();
}

// Actualizar contador del carrito
function updateCartCounter() {
  const totalItems = STATE.cart.reduce((sum, item) => sum + item.quantity, 0);
  DOM.cartCounter.textContent = totalItems;
}

// Alternar visibilidad del carrito
function toggleCart() {
  STATE.isCartOpen = !STATE.isCartOpen;
  
