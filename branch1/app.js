// ==========================================
// 1. استدعاء مكتبات Firebase
// ==========================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, doc, updateDoc, query, where } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ⚠️ ضع كود الـ Config الخاص بك هنا ⚠️
const firebaseConfig = {
  const firebaseConfig = {
    apiKey: "AIzaSyB20o1dChYXfgBmw0cro4qkdJK4zdcnhBs",
    authDomain: "negozio-43e16.firebaseapp.com",
    databaseURL: "https://negozio-43e16-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "negozio-43e16",
    storageBucket: "negozio-43e16.firebasestorage.app",
    messagingSenderId: "948335273399",
    appId: "1:948335273399:web:ecfc6d288e0a43914ef432",
    measurementId: "G-2RKC7BJBXZ"
  };

  // Initialize Firebase
  const app = initializeApp(firebaseConfig);
  const analytics = getAnalytics(app);
</script>
};

// تهيئة Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ==========================================
// 2. المتغيرات العامة وإعدادات الأمان
// ==========================================
const ADMIN_PASSWORD = "1234"; // الباسورد المحلي للإدارة
let cart = []; // سلة المشتريات الحالية
let productsList = []; // قائمة المنتجات المحملة من المخزن لتسريع البحث

// ==========================================
// 3. التنقل بين الواجهات ونظام الحماية
// ==========================================
const navPosBtn = document.getElementById('navPosBtn');
const navAdminBtn = document.getElementById('navAdminBtn');
const posSection = document.getElementById('posSection');
const adminSection = document.getElementById('adminSection');
const authModal = document.getElementById('authModal');

// فتح شاشة البيع
navPosBtn.addEventListener('click', () => {
    posSection.style.display = 'block';
    adminSection.style.display = 'none';
    navPosBtn.classList.add('active');
    navAdminBtn.classList.remove('active');
    document.getElementById('barcodeInput').focus();
});

// محاولة فتح شاشة الإدارة (تطلب باسورد)
navAdminBtn.addEventListener('click', () => {
    authModal.style.display = 'flex';
    document.getElementById('adminPasswordInput').focus();
});

// إغلاق نافذة الباسورد
document.getElementById('closeAuthBtn').addEventListener('click', () => {
    authModal.style.display = 'none';
    document.getElementById('adminPasswordInput').value = '';
});

// التحقق من الباسورد
document.getElementById('verifyAdminBtn').addEventListener('click', verifyPassword);
document.getElementById('adminPasswordInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') verifyPassword();
});

function verifyPassword() {
    const input = document.getElementById('adminPasswordInput').value;
    if (input === ADMIN_PASSWORD) {
        authModal.style.display = 'none';
        posSection.style.display = 'none';
        adminSection.style.display = 'block';
        navAdminBtn.classList.add('active');
        navPosBtn.classList.remove('active');
        document.getElementById('adminPasswordInput').value = '';
        loadInventory(); // تحميل المخزن عند الدخول
    } else {
        alert("كلمة المرور غير صحيحة!");
    }
}

// تبويبات الإدارة الداخلية
document.getElementById('tabInventoryBtn').addEventListener('click', () => switchAdminTab('inventoryTab', 'tabInventoryBtn'));
document.getElementById('tabExpensesBtn').addEventListener('click', () => switchAdminTab('expensesTab', 'tabExpensesBtn'));
document.getElementById('tabStatsBtn').addEventListener('click', () => {
    switchAdminTab('statsTab', 'tabStatsBtn');
    loadStats(); // حساب الأرباح عند فتح التبويب
});

function switchAdminTab(tabId, btnId) {
    document.getElementById('inventoryTab').style.display = 'none';
    document.getElementById('expensesTab').style.display = 'none';
    document.getElementById('statsTab').style.display = 'none';
    
    document.getElementById('tabInventoryBtn').classList.remove('active-tab');
    document.getElementById('tabExpensesBtn').classList.remove('active-tab');
    document.getElementById('tabStatsBtn').classList.remove('active-tab');

    document.getElementById(tabId).style.display = 'block';
    document.getElementById(btnId).classList.add('active-tab');
}

// ==========================================
// 4. إدارة المخزن (إضافة وعرض المنتجات)
// ==========================================

// إضافة منتج جديد
document.getElementById('addProductForm').addEventListener('submit', async (e) => {
    e.preventDefault(); // منع إعادة تحميل الصفحة
    const btn = e.target.querySelector('button');
    btn.innerText = "جاري الإضافة...";
    btn.disabled = true;

    const newProduct = {
        barcode: document.getElementById('prodBarcode').value,
        name: document.getElementById('prodName').value,
        buyPrice: parseFloat(document.getElementById('prodBuyPrice').value),
        sellPrice: parseFloat(document.getElementById('prodSellPrice').value),
        quantity: parseInt(document.getElementById('prodQty').value),
        minAlert: parseInt(document.getElementById('prodMinAlert').value)
    };

    try {
        await addDoc(collection(db, "products"), newProduct);
        alert("تمت إضافة المنتج بنجاح!");
        document.getElementById('addProductForm').reset();
        loadInventory(); // تحديث الجدول
    } catch (error) {
        console.error("Error adding document: ", error);
        alert("حدث خطأ أثناء الإضافة.");
    } finally {
        btn.innerText = "إضافة / تحديث المنتج";
        btn.disabled = false;
    }
});

// جلب المنتجات وعرضها في المخزن
async function loadInventory() {
    const tbody = document.getElementById('inventoryBody');
    tbody.innerHTML = '<tr><td colspan="6">جاري التحميل...</td></tr>';
    
    try {
        const querySnapshot = await getDocs(collection(db, "products"));
        productsList = []; // تفريغ القائمة المحلية لتحديثها
        tbody.innerHTML = '';

        querySnapshot.forEach((doc) => {
            let prod = doc.data();
            prod.id = doc.id; // حفظ الـ ID الخاص بـ Firebase للتحديث لاحقاً
            productsList.push(prod);

            // التحقق من النواقص
            let isLowStock = prod.quantity <= prod.minAlert ? 'low-stock' : '';

            tbody.innerHTML += `
                <tr class="${isLowStock}">
                    <td>${prod.barcode}</td>
                    <td>${prod.name}</td>
                    <td>${prod.quantity}</td>
                    <td>${prod.buyPrice}</td>
                    <td>${prod.sellPrice}</td>
                    <td><button onclick="alert('ميزة التعديل ستتم إضافتها لاحقاً')">تعديل</button></td>
                </tr>
            `;
        });
    } catch (error) {
        console.error("Error loading inventory: ", error);
        tbody.innerHTML = '<tr><td colspan="6">حدث خطأ في تحميل البيانات</td></tr>';
    }
}

// ==========================================
// 5. شاشة البيع (الكاشير والباركود)
// ==========================================

const barcodeInput = document.getElementById('barcodeInput');
barcodeInput.addEventListener('keypress', async (e) => {
    // إذا ضغط الكاشير أو قارئ الباركود على زر Enter
    if (e.key === 'Enter') {
        const code = barcodeInput.value.trim();
        if(code === "") return;

        // البحث في القائمة المحملة مسبقاً (أسرع بكثير من طلب قاعدة البيانات في كل مرة)
        if (productsList.length === 0) {
            // لو القائمة فاضية (الموقع لسه فاتح)، نجيبها الأول من السيرفر
            const querySnapshot = await getDocs(collection(db, "products"));
            productsList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        }

        const product = productsList.find(p => p.barcode === code || p.name.includes(code));

        if (product) {
            addToCart(product);
            barcodeInput.value = ''; // تفريغ الحقل للباركود التالي
        } else {
            alert("المنتج غير موجود!");
        }
    }
});

// إضافة المنتج للسلة
function addToCart(product) {
    // التحقق هل المنتج موجود في السلة أصلاً؟
    let existingItem = cart.find(item => item.id === product.id);
    
    if (existingItem) {
        // إذا الكمية المتاحة في المخزن تسمح بزيادة العدد
        if(existingItem.cartQty < product.quantity) {
            existingItem.cartQty += 1;
        } else {
            alert("الكمية المتاحة في المخزن لا تكفي!");
            return;
        }
    } else {
        if(product.quantity > 0) {
            cart.push({ ...product, cartQty: 1 });
        } else {
            alert("المنتج نفذ من المخزن!");
            return;
        }
    }
    renderCart();
}

// رسم جدول السلة وحساب الإجمالي
function renderCart() {
    const tbody = document.getElementById('cartBody');
    tbody.innerHTML = '';
    let total = 0;

    cart.forEach((item, index) => {
        let itemTotal = item.sellPrice * item.cartQty;
        total += itemTotal;

        tbody.innerHTML += `
            <tr>
                <td>${item.name}</td>
                <td>${item.sellPrice}</td>
                <td>
                    <button onclick="changeQty(${index}, 1)">+</button>
                    <span style="margin: 0 10px;">${item.cartQty}</span>
                    <button onclick="changeQty(${index}, -1)">-</button>
                </td>
                <td>${itemTotal}</td>
                <td><button onclick="removeFromCart(${index})" style="background-color: var(--danger-color);">حذف</button></td>
            </tr>
        `;
    });

    document.getElementById('cartTotal').innerText = total;
}

// تغيير الكمية من السلة
window.changeQty = function(index, amount) {
    if (cart[index].cartQty + amount > 0 && cart[index].cartQty + amount <= cart[index].quantity) {
        cart[index].cartQty += amount;
        renderCart();
    }
}

// حذف من السلة
window.removeFromCart = function(index) {
    cart.splice(index, 1);
    renderCart();
}

// ==========================================
// 6. تأكيد البيع وإنشاء الفاتورة
// ==========================================
document.getElementById('checkoutBtn').addEventListener('click', async () => {
    if (cart.length === 0) {
        alert("السلة فارغة!");
        return;
    }

    const btn = document.getElementById('checkoutBtn');
    btn.innerText = "جاري حفظ الفاتورة...";
    btn.disabled = true;

    let totalSales = 0;
    let totalCost = 0;
    
    // تجهيز عناصر الفاتورة
    const invoiceItems = cart.map(item => {
        totalSales += (item.sellPrice * item.cartQty);
        totalCost += (item.buyPrice * item.cartQty);
        return {
            productId: item.id,
            name: item.name,
            qty: item.cartQty,
            price: item.sellPrice
        };
    });

    const newInvoice = {
        timestamp: new Date().toISOString(),
        items: invoiceItems,
        totalSales: totalSales,
        totalCost: totalCost // نحفظ التكلفة عشان نحسب منها الأرباح بعدين
    };

    try {
        // 1. حفظ الفاتورة
        await addDoc(collection(db, "invoices"), newInvoice);

        // 2. خصم الكميات من المخزن
        for (const item of cart) {
            const productRef = doc(db, "products", item.id);
            const newQty = item.quantity - item.cartQty;
            await updateDoc(productRef, { quantity: newQty });
        }

        alert("تم البيع وحفظ الفاتورة بنجاح!");
        cart = []; // تفريغ السلة
        renderCart();
        productsList = []; // تفريغ القائمة لإجبار السيستم يجلب الكميات الجديدة
        document.getElementById('barcodeInput').focus();

    } catch (error) {
        console.error("Checkout Error: ", error);
        alert("حدث خطأ أثناء حفظ الفاتورة.");
    } finally {
        btn.innerText = "تأكيد البيع وحفظ الفاتورة";
        btn.disabled = false;
    }
});

// ==========================================
// 7. المصروفات والإحصائيات
// ==========================================

// تسجيل مصروف
document.getElementById('addExpenseForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    btn.innerText = "جاري التسجيل...";

    const newExpense = {
        title: document.getElementById('expTitle').value,
        amount: parseFloat(document.getElementById('expAmount').value),
        date: new Date().toISOString()
    };

    try {
        await addDoc(collection(db, "expenses"), newExpense);
        alert("تم تسجيل المصروف!");
        document.getElementById('addExpenseForm').reset();
    } catch (error) {
        console.error(error);
    } finally {
        btn.innerText = "تسجيل المصروف";
    }
});

// حساب الإحصائيات
async function loadStats() {
    try {
        let totalSales = 0;
        let totalCost = 0;
        let totalExpenses = 0;

        // جلب الفواتير
        const invoicesSnap = await getDocs(collection(db, "invoices"));
        invoicesSnap.forEach(doc => {
            totalSales += doc.data().totalSales;
            totalCost += doc.data().totalCost;
        });

        // جلب المصروفات
        const expensesSnap = await getDocs(collection(db, "expenses"));
        expensesSnap.forEach(doc => {
            totalExpenses += doc.data().amount;
        });

        // الحساب النهائي
        let grossProfit = totalSales - totalCost; // مجمل الربح
        let netProfit = grossProfit - totalExpenses; // صافي الربح

        document.getElementById('totalSalesStat').innerText = totalSales + " جنيه";
        document.getElementById('totalExpensesStat').innerText = totalExpenses + " جنيه";
        
        const netProfitEl = document.getElementById('netProfitStat');
        netProfitEl.innerText = netProfit + " جنيه";
        netProfitEl.style.color = netProfit >= 0 ? "var(--success-color)" : "var(--danger-color)";

    } catch (error) {
        console.error("Error loading stats: ", error);
    }
}
