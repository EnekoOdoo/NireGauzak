
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut, signInAnonymously, signInWithCustomToken } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, addDoc, onSnapshot, query, serverTimestamp, doc, updateDoc, deleteDoc, getDocs } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { setLogLevel } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";

// Configuración de la base de datos
setLogLevel('Debug');
let app, db, auth;
let userId = null;
let authReady = false;
let unsubscribeTrips = null;
let unsubscribeExpenses = null;
let selectedTripId = null;
let selectedTripName = null;
let selectedTripStatus = null;
let editingExpenseId = null;
let allExpenses = []; // Variable para almacenar los gastos para la exportación

// Variables de entorno de la aplicación
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : '{}');
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// Elementos de la UI
const loadingMessage = document.getElementById('loading-message');
const appContainer = document.getElementById('app-container');
const authContainer = document.getElementById('auth-container');
const userInfo = document.getElementById('user-info');
const logoutBtn = document.getElementById('logout-btn');
const tripsContainer = document.getElementById('trips-container');
const expensesContainer = document.getElementById('expenses-container');
const tripsList = document.getElementById('trips-list');
const addTripBtn = document.getElementById('add-trip-btn');
const backToTripsBtn = document.getElementById('back-to-trips-btn');
const currentTripNameEl = document.getElementById('current-trip-name');
const currentTripStatusEl = document.getElementById('current-trip-status');
const tripClosedMessageEl = document.getElementById('trip-closed-message');
const expenseForm = document.getElementById('expense-form');
const expenseDateInput = document.getElementById('expense-date');
const expenseConceptInput = document.getElementById('expense-concept');
const expenseAmountInput = document.getElementById('expense-amount');
const expenseCategoryInputs = document.querySelectorAll('input[name="category"]');
const submitExpenseBtn = document.getElementById('submit-expense-btn');
const expensesList = document.getElementById('expenses-list');
const appMessage = document.getElementById('app-message');
const receiptPhotoInput = document.getElementById('receipt-photo');
const imagePreviewContainer = document.getElementById('image-preview');
const previewImage = document.getElementById('preview-image');
const removeImageButton = document.getElementById('remove-image');
const expensesSummary = document.getElementById('expenses-summary');
const totalExpensesAmount = document.getElementById('total-expenses-amount');
const closeTripBtn = document.getElementById('close-trip-btn');
const confirmModal = document.getElementById('confirm-modal');
const confirmMessage = document.getElementById('confirm-message');
const confirmYesBtn = document.getElementById('confirm-yes');
const confirmNoBtn = document.getElementById('confirm-no');
const reportOptions = document.getElementById('report-options');
const exportCsvBtn = document.getElementById('export-csv-btn');
const downloadZipBtn = document.getElementById('download-zip-btn');
const emailReportBtn = document.getElementById('email-report-btn');

const authEmailInput = document.getElementById('auth-email');
const authPasswordInput = document.getElementById('auth-password');
const signupBtn = document.getElementById('signup-btn');
const signinBtn = document.getElementById('signin-btn');

let uploadedFile = null;

// Gestor de autenticación
async function setupFirebase() {
	try {
		showMessage('Iniciando configuración de Firebase...', 'warning');
		app = initializeApp(firebaseConfig);
		db = getFirestore(app);
		auth = getAuth(app);
		showMessage('Firebase inicializado. Esperando autenticación...', 'warning');

		// Espera a que el estado de autenticación cambie
		const unsubscribe = onAuthStateChanged(auth, async (user) => {
			unsubscribe();
			if (!user && initialAuthToken) {
				 try {
					 await signInWithCustomToken(auth, initialAuthToken);
					 showMessage('Inicio de sesión con token personalizado exitoso.', 'success');
				 } catch (error) {
					 showMessage('Error con token personalizado. Se usará sesión anónima.', 'error');
					 await signInAnonymously(auth);
				 }
			} else if (!user) {
			   await signInAnonymously(auth);
			   showMessage('Sesión anónima iniciada.', 'warning');
			}
            
			loadingMessage.style.display = 'none';
			if (auth.currentUser) {
				userId = auth.currentUser.uid;
				authReady = true;
				userInfo.textContent = `ID de Usuario: ${auth.currentUser.email || auth.currentUser.uid}`;
				logoutBtn.classList.remove('hidden');
				appContainer.classList.remove('hidden');
				authContainer.classList.add('hidden');
				showMessage('Autenticación exitosa.', 'success');
				setupTripsListener();
			} else {
				userId = null;
				authReady = false;
				logoutBtn.classList.add('hidden');
				appContainer.classList.add('hidden');
				authContainer.classList.remove('hidden');
				showMessage('No autenticado. Por favor, inicia sesión.', 'warning');
				if (unsubscribeTrips) unsubscribeTrips();
				if (unsubscribeExpenses) unsubscribeExpenses();
			}
		});

	} catch (error) {
		loadingMessage.style.display = 'none';
		showMessage('Error crítico: No se pudo inicializar la aplicación. Revisa la configuración.', 'error');
	}
}

// Eventos de autenticación
signupBtn.addEventListener('click', async () => {
	signupBtn.classList.add('btn-disabled');
	signinBtn.classList.add('btn-disabled');
	showMessage('Procesando registro...', 'warning');
	try {
		const email = authEmailInput.value;
		const password = authPasswordInput.value;
		await createUserWithEmailAndPassword(auth, email, password);
		showMessage('Cuenta creada con éxito. ¡Ya puedes acceder a tus viajes!', 'success');
	} catch (error) {
		showMessage('Error al crear la cuenta: ' + (error.message || ''), 'error');
	} finally {
		signupBtn.classList.remove('btn-disabled');
		signinBtn.classList.remove('btn-disabled');
	}
});

signinBtn.addEventListener('click', async () => {
	signupBtn.classList.add('btn-disabled');
	signinBtn.classList.add('btn-disabled');
	showMessage('Procesando inicio de sesión...', 'warning');
	try {
		const email = authEmailInput.value;
		const password = authPasswordInput.value;
		await signInWithEmailAndPassword(auth, email, password);
		showMessage('¡Bienvenido! Sesión iniciada.', 'success');
	} catch (error) {
		showMessage('Error al iniciar sesión: ' + (error.message || ''), 'error');
	} finally {
		signupBtn.classList.remove('btn-disabled');
		signinBtn.classList.remove('btn-disabled');
	}
});

logoutBtn.addEventListener('click', async () => {
	await signOut(auth);
	showMessage('Sesión cerrada correctamente.', 'success');
});

// Listener para la foto del ticket
receiptPhotoInput.addEventListener('change', (e) => {
	const file = e.target.files[0];
	if (file) {
		uploadedFile = file;
		const fileUrl = URL.createObjectURL(file);
		previewImage.src = fileUrl;
		imagePreviewContainer.style.display = 'block';
	}
});

// Botón para eliminar la foto
removeImageButton.addEventListener('click', () => {
	uploadedFile = null;
	receiptPhotoInput.value = '';
	imagePreviewContainer.style.display = 'none';
	previewImage.src = '#';
});

// Listener en tiempo real para la lista de viajes
function setupTripsListener() {
	if (!authReady) {
		console.log("Autenticación no lista, no se puede configurar el listener de viajes.");
		return;
	}
	if (unsubscribeTrips) unsubscribeTrips();
	const q = query(collection(db, `artifacts/${appId}/users/${userId}/viajes`));
	unsubscribeTrips = onSnapshot(q, (querySnapshot) => {
		tripsList.innerHTML = '';
		if (querySnapshot.empty) {
			tripsList.innerHTML = '<p class="text-gray-500 text-center">Todavía no hay viajes registrados.</p>';
		} else {
			querySnapshot.forEach((doc) => {
				const trip = doc.data();
				const li = document.createElement('li');
				li.className = 'bg-gray-50 p-4 rounded-md shadow-sm cursor-pointer hover:bg-gray-100 transition-colors';
				li.dataset.tripId = doc.id;
				li.innerHTML = `
					<div class="flex justify-between items-center">
						<p class="text-base font-semibold text-gray-900">${trip.nombre}</p>
						<span class="text-xs font-bold px-2 py-0.5 rounded-full ${trip.estado === 'abierto' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}">${trip.estado}</span>
					</div>
				`;
				li.addEventListener('click', () => selectTrip(doc.id, trip.nombre, trip.estado));
				tripsList.appendChild(li);
			});
		}
	});
}

// Seleccionar un viaje
function selectTrip(tripId, tripName, tripStatus) {
	selectedTripId = tripId;
	selectedTripName = tripName;
	selectedTripStatus = tripStatus;
	currentTripNameEl.textContent = tripName;
	currentTripStatusEl.textContent = `Estado: ${tripStatus}`;
	currentTripStatusEl.className = `text-sm font-semibold ${tripStatus === 'abierto' ? 'text-green-600' : 'text-red-600'}`;
	tripsContainer.classList.add('hidden');
	expensesContainer.classList.remove('hidden');

	if (tripStatus === 'cerrado') {
		expenseForm.classList.add('hidden');
		tripClosedMessageEl.classList.remove('hidden');
		submitExpenseBtn.disabled = true;
		closeTripBtn.classList.add('hidden');
	} else {
		expenseForm.classList.remove('hidden');
		tripClosedMessageEl.classList.add('hidden');
		submitExpenseBtn.disabled = false;
		closeTripBtn.classList.remove('hidden');
	}

	expensesSummary.classList.remove('hidden');
	setupExpensesListener();
}

// Volver a la lista de viajes
backToTripsBtn.addEventListener('click', () => {
	tripsContainer.classList.remove('hidden');
	expensesContainer.classList.add('hidden');
	if (unsubscribeExpenses) unsubscribeExpenses();
	selectedTripId = null;
	editingExpenseId = null;
	expenseForm.reset();
	removeImageButton.click();
	submitExpenseBtn.textContent = 'Guardar Gasto';
	reportOptions.classList.add('hidden');
});

// Añadir nuevo viaje
addTripBtn.addEventListener('click', async () => {
	const tripName = prompt("Introduce el nombre del nuevo viaje:");
	if (tripName) {
		try {
			const tripsCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/viajes`);
			await addDoc(tripsCollectionRef, {
				nombre: tripName,
				estado: 'abierto',
				createdAt: serverTimestamp()
			});
			showMessage('Viaje creado con éxito!', 'success');
		} catch (error) {
			console.error("Error al crear el viaje:", error);
			showMessage('Error al crear el viaje. Inténtalo de nuevo.', 'error');
		}
	}
});

// Cerrar un viaje
closeTripBtn.addEventListener('click', async () => {
	 showConfirmModal('¿Estás seguro de que quieres cerrar este viaje? No se podrán añadir más gastos.', async () => {
		 if (selectedTripId) {
			try {
				const tripDocRef = doc(db, `artifacts/${appId}/users/${userId}/viajes/${selectedTripId}`);
				await updateDoc(tripDocRef, { estado: 'cerrado' });
				showMessage('Viaje cerrado con éxito!', 'success');
			} catch (error) {
				console.error("Error al cerrar el viaje:", error);
				showMessage('Error al cerrar el viaje. Inténtalo de nuevo.', 'error');
			}
		}
	 });
});

// Función para mostrar el modal de confirmación
function showConfirmModal(message, onConfirm) {
	confirmMessage.textContent = message;
	confirmModal.classList.remove('hidden');

	const handleYes = () => {
		onConfirm();
		confirmModal.classList.add('hidden');
		confirmYesBtn.removeEventListener('click', handleYes);
		confirmNoBtn.removeEventListener('click', handleNo);
	};

	const handleNo = () => {
		confirmModal.classList.add('hidden');
		confirmYesBtn.removeEventListener('click', handleYes);
		confirmNoBtn.removeEventListener('click', handleNo);
	};

	confirmYesBtn.addEventListener('click', handleYes);
	confirmNoBtn.addEventListener('click', handleNo);
}

// Listener en tiempo real para los gastos del viaje seleccionado
function setupExpensesListener() {
	if (!authReady || !selectedTripId) {
		console.log("Autenticación o viaje no seleccionados, no se puede configurar el listener de gastos.");
		return;
	}
	if (unsubscribeExpenses) unsubscribeExpenses();
	const q = query(collection(db, `artifacts/${appId}/users/${userId}/viajes/${selectedTripId}/gastos`));
	unsubscribeExpenses = onSnapshot(q, (querySnapshot) => {
		allExpenses = [];
		let totalAmount = 0;
		querySnapshot.forEach((doc) => {
			const expense = doc.data();
			allExpenses.push({ id: doc.id, ...expense });
			totalAmount += expense.amount;
		});

		expensesList.innerHTML = '';
		if (allExpenses.length === 0) {
			expensesList.innerHTML = '<p class="text-gray-500 text-center">Todavía no hay gastos registrados en este viaje.</p>';
			reportOptions.classList.add('hidden');
		} else {
			reportOptions.classList.remove('hidden');
			// Ordenar por fecha (más reciente primero)
			allExpenses.sort((a, b) => {
				const dateA = a.createdAt ? a.createdAt.toDate() : new Date(0);
				const dateB = b.createdAt ? b.createdAt.toDate() : new Date(0);
				return dateB - dateA;
			});
		}
        
		allExpenses.forEach(expense => {
			const li = document.createElement('li');
			li.className = 'bg-gray-50 p-4 rounded-md shadow-sm border-l-4 border-indigo-500 flex justify-between items-center';
			li.innerHTML = `
				<div class="flex-grow">
					<p class="text-sm font-semibold text-gray-800">${new Date(expense.date).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
					<p class="text-base font-medium text-gray-900">${expense.concept}</p>
					<span class="text-xs text-indigo-600 font-bold px-2 py-0.5 rounded-full bg-indigo-100">${expense.category}</span>
				</div>
				<div class="flex items-center space-x-2">
					<span class="text-xl font-bold text-gray-800">${expense.amount.toFixed(2)}€</span>
					${expense.receiptPhotoUrl ? `<img src="${expense.receiptPhotoUrl}" alt="Ticket" class="w-12 h-12 object-cover rounded-md shadow">` : ''}
					<button class="edit-expense-btn ${selectedTripStatus === 'cerrado' ? 'hidden' : ''}" data-expense-id="${expense.id}" aria-label="Editar gasto">
						<svg class="w-5 h-5 text-indigo-500 hover:text-indigo-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
					</button>
					<button class="delete-expense-btn ${selectedTripStatus === 'cerrado' ? 'hidden' : ''}" data-expense-id="${expense.id}" aria-label="Eliminar gasto">
						<svg class="w-5 h-5 text-red-500 hover:text-red-700" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"></path></svg>
					</button>
				</div>
			`;
			expensesList.appendChild(li);
		});

		totalExpensesAmount.textContent = `${totalAmount.toFixed(2)}€`;
	});
}
        
// Listener para editar un gasto
expensesList.addEventListener('click', (e) => {
	const editBtn = e.target.closest('.edit-expense-btn');
	if (editBtn && selectedTripStatus === 'abierto') {
		const expenseId = editBtn.dataset.expenseId;
		const expenseData = allExpenses.find(exp => exp.id === expenseId);
		if (expenseData) {
			editingExpenseId = expenseId;
			expenseDateInput.value = expenseData.date;
			expenseConceptInput.value = expenseData.concept;
			expenseAmountInput.value = expenseData.amount;
			expenseCategoryInputs.forEach(input => {
				if (input.value === expenseData.category) {
					input.checked = true;
				}
			});
			submitExpenseBtn.textContent = 'Actualizar Gasto';
		} else {
			showMessage('Error: El gasto no existe.', 'error');
		}
	}
});

// Listener para eliminar un gasto
expensesList.addEventListener('click', (e) => {
	const deleteBtn = e.target.closest('.delete-expense-btn');
	if (deleteBtn && selectedTripStatus === 'abierto') {
		const expenseId = deleteBtn.dataset.expenseId;
		showConfirmModal('¿Estás seguro de que quieres eliminar este gasto?', async () => {
			try {
				const expenseDocRef = doc(db, `artifacts/${appId}/users/${userId}/viajes/${selectedTripId}/gastos/${expenseId}`);
				await deleteDoc(expenseDocRef);
				showMessage('Gasto eliminado con éxito!', 'success');
			} catch (error) {
				console.error("Error al eliminar el gasto:", error);
				showMessage('Error al eliminar el gasto. Inténtalo de nuevo.', 'error');
			}
		});
	}
});

// Manejo del formulario
expenseForm.addEventListener('submit', async (e) => {
	e.preventDefault();
	if (!authReady || !selectedTripId || selectedTripStatus === 'cerrado') {
		showMessage('No se puede guardar el gasto.', 'warning');
		return;
	}

	const formData = new FormData(expenseForm);
	const data = {
		date: formData.get('date'),
		concept: formData.get('concept'),
		amount: parseFloat(formData.get('amount')),
		category: formData.get('category'),
	};

	if (editingExpenseId) {
		// Modo edición: actualizar el gasto
		try {
			const expenseDocRef = doc(db, `artifacts/${appId}/users/${userId}/viajes/${selectedTripId}/gastos/${editingExpenseId}`);
			await updateDoc(expenseDocRef, data);
			showMessage('Gasto actualizado con éxito!', 'success');
		} catch (error) {
			console.error("Error al actualizar el gasto:", error);
			showMessage('Error al actualizar el gasto. Inténtalo de nuevo.', 'error');
		}
	} else {
		// Modo normal: añadir un nuevo gasto
		try {
			const expensesCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/viajes/${selectedTripId}/gastos`);
			await addDoc(expensesCollectionRef, { ...data, createdAt: serverTimestamp(), receiptPhotoUrl: uploadedFile ? 'https://placehold.co/150x150/000000/FFFFFF?text=Ticket' : null });
			showMessage('Gasto guardado con éxito!', 'success');
		} catch (error) {
			console.error("Error al guardar el documento:", error);
			showMessage('Error al guardar el gasto. Inténtalo de nuevo.', 'error');
		}
	}

	// Restablecer el formulario y el estado de edición
	expenseForm.reset();
	removeImageButton.click();
	editingExpenseId = null;
	submitExpenseBtn.textContent = 'Guardar Gasto';
});

// Función personalizada para descargar archivos
function downloadFile(data, filename, mimeType) {
	const blob = new Blob([data], { type: mimeType });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(url);
}

// Función para exportar los gastos a CSV
exportCsvBtn.addEventListener('click', () => {
	if (allExpenses.length === 0) {
		showMessage('No hay gastos para exportar.', 'warning');
		return;
	}

	const header = ["ID Gasto", "Fecha", "Concepto", "Importe (€)", "Categoría", "URL Foto Ticket"];
	const rows = allExpenses.map(exp => [
		exp.id,
		exp.date,
		exp.concept,
		exp.amount.toFixed(2),
		exp.category,
		exp.receiptPhotoUrl || 'N/A'
	]);

	const csvContent = [
		header.join(","),
		...rows.map(row => row.join(","))
	].join("\n");

	downloadFile(csvContent, `${selectedTripName}_gastos.csv`, "text/csv");
	showMessage('Archivo CSV descargado con éxito.', 'success');
});

// Función para simular la descarga de fotos en un ZIP
downloadZipBtn.addEventListener('click', () => {
	// Dado que no podemos manejar subidas de archivos en este entorno,
	// esta función simula la descarga de un archivo ZIP.
	const mockZipContent = `Esto es un archivo ZIP simulado para el viaje "${selectedTripName}".`;
	downloadFile(mockZipContent, `${selectedTripName}_fotos.zip`, "application/zip");
	showMessage('Descarga de fotos simulada con éxito.', 'success');
});

// Función para enviar el informe por correo
emailReportBtn.addEventListener('click', () => {
	const subject = `Informe de Gastos - Viaje: ${selectedTripName}`;
	const body = `Hola,\n\nAdjunto el informe de gastos de mi viaje "${selectedTripName}".\n\nResumen:\n- Total de Gastos: ${totalExpensesAmount.textContent}\n\nPor favor, revisa el archivo CSV y el archivo ZIP adjuntos.\n\nSaludos.`;
	const mailtoLink = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
	window.location.href = mailtoLink;
});

// Función para mostrar mensajes de la app
function showMessage(message, type) {
	appMessage.textContent = message;
	appMessage.className = 'text-sm text-center font-medium p-2 rounded-md transition-all duration-300 w-full max-w-lg';
	if (type === 'success') {
		appMessage.classList.add('bg-green-100', 'text-green-700');
	} else if (type === 'error') {
		appMessage.classList.add('bg-red-100', 'text-red-700');
	} else if (type === 'warning') {
		appMessage.classList.add('bg-yellow-100', 'text-yellow-700');
	}
	setTimeout(() => {
		appMessage.textContent = '';
		appMessage.classList.remove('bg-green-100', 'text-green-700', 'bg-red-100', 'text-red-700', 'bg-yellow-100', 'text-yellow-700');
	}, 3000);
}

// Iniciar la aplicación al cargar la página
window.onload = setupFirebase;
