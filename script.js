// Configuración de la aplicación
const CONFIG = {
  API_URL: "https://script.google.com/macros/s/AKfycbx7RtyFhGGh2jlSXKwwsMkpBbLNW944mCfr5NLChV3mPaCkLait7gQcpfQRLAGI_pmdkQ/exec",
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
  notification: document.getElementById("notification"),
  resetFilters: document.getElementById("reset-filters"),
  resetSearch: document.getElementById("reset-search")
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
  DOM.resetFilters.addEventListener("click", resetAllFilters);
  DOM.resetSearch.addEventListener("click", resetSearch);
  
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
    
    const responseData = await response.json();
    
    if (responseData.status !== "success") {
      throw new Error(responseData.message || "Error en la respuesta del servidor");
    }
    
    STATE.products = responseData.data;
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

// Reiniciar todos los filtros
function resetAllFilters() {
  DOM.searchInput.value = "";
  DOM.categoryFilter.value = "";
  DOM.priceFilter.value = DOM.priceFilter.max;
  updatePriceFilter();
  filterProducts();
  showNotification("Filtros reiniciados");
}

// Reiniciar búsqueda
function resetSearch() {
  DOM.searchInput.value = "";
  filterProducts();
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
  card.className = "product-card glass-card";
  
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
      <img src="${product.image || 'https://via.placeholder.com/300x200?text=No+Image'}" alt="${product.name}" loading="lazy">
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
  
  // Efecto visual en el contador del carrito
  DOM.cartCounter.classList.add("pulse-on-update");
  setTimeout(() => {
    DOM.cartCounter.classList.remove("pulse-on-update");
  }, 500);
  
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
      <div class="empty-cart glass-card">
        <i class="fas fa-shopping-basket"></i>
        <p>Tu carrito está vacío</p>
        <button class="btn-primary" onclick="closeCart()">
          <i class="fas fa-arrow-left"></i> Seguir comprando
        </button>
      </div>
    `;
    updateCartTotals();
    return;
  }
  
  STATE.cart.forEach(item => {
    const cartItem = document.createElement("div");
    cartItem.className = "cart-item";
    
    cartItem.innerHTML = `
      <div class="cart-item-image glass-card">
        <img src="${item.image || 'https://via.placeholder.com/100x100?text=No+Image'}" alt="${item.name}" loading="lazy">
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
  DOM.cartSidebar.classList.toggle("open", STATE.isCartOpen);
  DOM.cartOverlay.classList.toggle("active", STATE.isCartOpen);
  
  // Bloquear scroll del body cuando el carrito está abierto
  document.body.style.overflow = STATE.isCartOpen ? "hidden" : "auto";
}

// Cerrar carrito
function closeCart() {
  STATE.isCartOpen = false;
  DOM.cartSidebar.classList.remove("open");
  DOM.cartOverlay.classList.remove("active");
  document.body.style.overflow = "auto";
}

// Manejar el proceso de compra
async function handleCheckout(e) {
  e.preventDefault();
  
  // Obtener valores del formulario
  const customerName = DOM.customerName.value.trim();
  const customerPhone = DOM.customerPhone.value.trim();
  const deliveryMethod = DOM.deliveryMethod.value;
  const paymentMethod = DOM.paymentMethod.value;
  
  // Validar datos
  if (!customerName || !customerPhone || STATE.cart.length === 0) {
    showNotification("Por favor, completa todos los campos y añade productos al carrito", "error");
    return;
  }
  
  // Validar teléfono
  if (!/^[\d\s+-]+$/.test(customerPhone)) {
    showNotification("Por favor, ingresa un número de teléfono válido", "error");
    return;
  }
  
  // Construir objeto de pedido
  const order = {
    customerName,
    customerPhone,
    deliveryMethod,
    paymentMethod,
    items: STATE.cart.map(item => ({
      id: item.id,
      name: item.name,
      price: item.price,
      quantity: item.quantity
    }))
  };
  
  try {
    // Mostrar estado de carga
    const submitBtn = DOM.checkoutForm.querySelector("button");
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Procesando...';
    submitBtn.disabled = true;
    
    // Enviar pedido al backend
    const response = await fetch(`${CONFIG.API_URL}?action=saveOrder`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `order=${encodeURIComponent(JSON.stringify(order))}`
    });
    
    if (!response.ok) throw new Error("Error al guardar el pedido");
    
    const responseData = await response.json();
    
    if (responseData.status !== "success") {
      throw new Error(responseData.message || "Error en la respuesta del servidor");
    }
    
    // Mostrar mensaje de éxito
    showNotification(`Pedido #${responseData.data.orderId} enviado con éxito!`, "success");
    
    // Enviar por WhatsApp
    sendWhatsAppMessage(order, responseData.data.orderId, responseData.data.total);
    
    // Limpiar carrito y formulario
    STATE.cart = [];
    updateCart();
    DOM.checkoutForm.reset();
    closeCart();
    
  } catch (error) {
    console.error("Error:", error);
    showNotification(error.message, "error");
  } finally {
    // Restaurar botón
    const submitBtn = DOM.checkoutForm.querySelector("button");
    submitBtn.innerHTML = '<i class="fab fa-whatsapp"></i> Confirmar Pedido';
    submitBtn.disabled = false;
  }
}

// Enviar mensaje por WhatsApp
function sendWhatsAppMessage(order, orderId, total) {
  // Construir mensaje detallado
  const itemsText = order.items.map(item => 
    `• ${item.name} - ${item.quantity} x ${CONFIG.CURRENCY}${item.price.toFixed(2)}`
  ).join("\n");
  
  const message = `¡Nuevo pedido desde el catálogo online!
  
*ID:* ${orderId}
*Cliente:* ${order.customerName}
*Teléfono:* ${order.customerPhone}
*Método de entrega:* ${order.deliveryMethod}
*Método de pago:* ${order.paymentMethod}

*Productos:*
${itemsText}

*Subtotal:* ${CONFIG.CURRENCY}${(total - CONFIG.SHIPPING_COST).toFixed(2)}
*Envío:* ${CONFIG.CURRENCY}${(order.deliveryMethod === "Domicilio" ? CONFIG.SHIPPING_COST : 0).toFixed(2)}
*TOTAL:* ${CONFIG.CURRENCY}${total.toFixed(2)}

Por favor, procesa este pedido. ¡Gracias!`;
  
  // Crear URL de WhatsApp
  const whatsappUrl = `https://wa.me/${CONFIG.WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
  
  // Abrir en nueva pestaña
  window.open(whatsappUrl, "_blank");
}

// Mostrar notificación
function showNotification(message, type = "success") {
  DOM.notification.textContent = message;
  DOM.notification.className = "notification show";
  
  if (type === "error") {
    DOM.notification.classList.add("error");
  } else {
    DOM.notification.classList.remove("error");
  }
  
  // Ocultar después de 5 segundos
  setTimeout(() => {
    DOM.notification.classList.remove("show");
  }, 5000);
}

// Iniciar la aplicación al cargar la página
window.addEventListener("DOMContentLoaded", init);

// Hacer funciones disponibles globalmente para eventos HTML
window.addToCart = addToCart;
window.updateCartItemQuantity = updateCartItemQuantity;
window.removeFromCart = removeFromCart;
window.toggleCart = toggleCart;
