// Configuración de la aplicación
const CONFIG = {
  API_URL: "https://script.google.com/macros/s/AKfycbwz9BkaSDPzdbmdhKfxcPZlH2Qcsa1X9WY3BM0aeFFM/dev",
  SHIPPING_COST: 5.00,
  LOW_STOCK_THRESHOLD: 5,
  WHATSAPP_NUMBER: "+584166367466",
  CURRENCY: "$",
  DEFAULT_IMAGE: 'https://via.placeholder.com/300x200.png?text=Producto+sin+imagen'
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
    if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);
    
    const responseData = await response.json();
    
    if (responseData.error) {
      throw new Error(responseData.error);
    }
    
    if (responseData.status !== "success") {
      throw new Error(responseData.message || "Error en la respuesta del servidor");
    }
    
    STATE.products = responseData.data.map(product => ({
      ...product,
      // Asegurar que la imagen sea válida
      image: product.image && product.image.startsWith('http') ? product.image : CONFIG.DEFAULT_IMAGE
    }));
    
    STATE.filteredProducts = [...STATE.products];
    
    populateCategories();
    updatePriceFilterRange();
    filterProducts();
  } catch (error) {
    console.error("Error al cargar productos:", error);
    showNotification("Error al cargar los productos. Intenta recargar la página.", "error");
  } finally {
    STATE.isLoading = false;
    hideLoader();
  }
}

// Crear tarjeta de producto con manejo seguro de imágenes
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
      <img src="${product.image}" alt="${product.name}" loading="lazy" 
           onerror="this.src='${CONFIG.DEFAULT_IMAGE}'">
      ${product.stock <= CONFIG.LOW_STOCK_THRESHOLD && product.stock > 0 ? 
        `<span class="product-badge">¡Últimas unidades!</span>` : ''}
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

// Manejar el proceso de compra con mejor manejo de errores
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
    const response = await fetch(CONFIG.API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `action=saveOrder&order=${encodeURIComponent(JSON.stringify(order))}`
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(errorData?.message || `Error HTTP: ${response.status}`);
    }
    
    const responseData = await response.json();
    
    if (responseData.error) {
      throw new Error(responseData.error);
    }
    
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
    console.error("Error en checkout:", error);
    let errorMessage = "Error al procesar el pedido";
    
    if (error.message.includes("Failed to fetch")) {
      errorMessage = "No se pudo conectar con el servidor. Verifica tu conexión a internet.";
    } else if (error.message.includes("HTTP")) {
      errorMessage = `Error del servidor: ${error.message}`;
    } else {
      errorMessage = error.message;
    }
    
    showNotification(errorMessage, "error");
  } finally {
    // Restaurar botón
    const submitBtn = DOM.checkoutForm.querySelector("button");
    submitBtn.innerHTML = '<i class="fab fa-whatsapp"></i> Confirmar Pedido';
    submitBtn.disabled = false;
  }
}

// ... (resto de las funciones permanecen igual que en la versión anterior)

// Iniciar la aplicación al cargar la página
window.addEventListener("DOMContentLoaded", init);

// Hacer funciones disponibles globalmente para eventos HTML
window.addToCart = addToCart;
window.updateCartItemQuantity = updateCartItemQuantity;
window.removeFromCart = removeFromCart;
window.toggleCart = toggleCart;
