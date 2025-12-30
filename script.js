const GoalApp = {
  user: null,
  goals: [],
  currentGoal: null,
  editingTaskId: null,
  editingGoalId: null,
  currentView: 'cards',
  theme: localStorage.getItem('goalmap-theme') || 'light',
  pendingDelete: null,
  goalSort: 'newest'
};

document.addEventListener('DOMContentLoaded', function() {
  initApp();
});

function initApp() {
  try {
    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }
    GoalApp.auth = firebase.auth();
    GoalApp.db = firebase.firestore();
  } catch (err) {
    console.error('Firebase error:', err);
    return;
  }
  
  setupElements();
  setupEvents();
  setTheme(GoalApp.theme);
  checkAuth();
}

function setupElements() {
  GoalApp.elems = {
    themeToggle: document.getElementById('themeToggle'),
    newGoalBtn: document.getElementById('newGoalBtn'),
    addTaskBtn: document.getElementById('addTaskBtn'),
    editGoalBtn: document.getElementById('editGoalBtn'),
    logoutBtn: document.getElementById('logoutBtn'),
    backToCards: document.getElementById('backToCards'),
    authModal: document.getElementById('authModal'),
    goalModal: document.getElementById('goalModal'),
    taskModal: document.getElementById('taskModal'),
    deleteConfirmModal: document.getElementById('deleteConfirmModal'),
    loginForm: document.getElementById('loginForm'),
    registerForm: document.getElementById('registerForm'),
    goalForm: document.getElementById('goalForm'),
    taskForm: document.getElementById('taskForm'),
    userName: document.getElementById('userName'),
    userInitial: document.getElementById('userInitial'),
    userSection: document.getElementById('userSection'),
    cardsGrid: document.getElementById('cardsGrid'),
    tasksContainer: document.getElementById('tasksContainer'),
    currentGoalTitle: document.getElementById('currentGoalTitle'),
    goalDescription: document.getElementById('goalDescription'),
    totalGoalsCount: document.getElementById('totalGoalsCount'),
    completedGoalsCount: document.getElementById('completedGoalsCount'),
    progressPercent: document.getElementById('progressPercent'),
    progressBar: document.getElementById('progressBar'),
    completedTasks: document.getElementById('completedTasks'),
    totalTasks: document.getElementById('totalTasks'),
    goalModalTitle: document.getElementById('goalModalTitle'),
    goalSubmitBtn: document.getElementById('goalSubmitBtn'),
    deleteConfirmMessage: document.getElementById('deleteConfirmMessage'),
    cancelDeleteBtn: document.getElementById('cancelDeleteBtn'),
    confirmDeleteBtn: document.getElementById('confirmDeleteBtn'),
    closeDeleteConfirm: document.getElementById('closeDeleteConfirm'),
    taskSort: document.getElementById('taskSort'),
    goalSort: document.getElementById('goalSort'),
    totalGoalsStat: document.getElementById('totalGoalsStat'),
    completedGoalsStat: document.getElementById('completedGoalsStat'),
    totalTasksStat: document.getElementById('totalTasksStat'),
    productivityStat: document.getElementById('productivityStat')
  };
}

function setupEvents() {
  GoalApp.elems.themeToggle?.addEventListener('click', toggleTheme);
  GoalApp.elems.newGoalBtn?.addEventListener('click', () => openGoalModal());
  GoalApp.elems.addTaskBtn?.addEventListener('click', () => openTaskModal());
  GoalApp.elems.editGoalBtn?.addEventListener('click', () => {
    if (GoalApp.currentGoal) openGoalModal(GoalApp.currentGoal.id);
  });
  GoalApp.elems.logoutBtn?.addEventListener('click', logoutUser);
  GoalApp.elems.backToCards?.addEventListener('click', switchToCardsView);
  
  GoalApp.elems.cancelDeleteBtn?.addEventListener('click', () => closeModal('deleteConfirmModal'));
  GoalApp.elems.closeDeleteConfirm?.addEventListener('click', () => closeModal('deleteConfirmModal'));
  GoalApp.elems.confirmDeleteBtn?.addEventListener('click', deleteItemConfirmed);
  
  GoalApp.elems.loginForm?.addEventListener('submit', handleLogin);
  GoalApp.elems.registerForm?.addEventListener('submit', handleRegister);
  GoalApp.elems.goalForm?.addEventListener('submit', handleGoalForm);
  GoalApp.elems.taskForm?.addEventListener('submit', handleTaskForm);
  GoalApp.elems.taskSort?.addEventListener('change', sortTasks);
  GoalApp.elems.goalSort?.addEventListener('change', sortGoals);
  
  document.querySelectorAll('.auth-tab').forEach(tab => {
    tab.addEventListener('click', function(e) {
      e.preventDefault();
      switchAuthTab(this.getAttribute('data-tab'));
    });
  });
  
  document.querySelectorAll('.workspace-tab').forEach(tab => {
    tab.addEventListener('click', function() {
      switchWorkspaceView(this.getAttribute('data-view'));
    });
  });
  
  document.querySelectorAll('.modal-overlay').forEach(modal => {
    modal.addEventListener('click', function(e) {
      if (e.target === this) {
        closeModal(this.id);
      }
    });
  });
  
  document.getElementById('closeAuth')?.addEventListener('click', () => closeModal('authModal'));
  document.getElementById('closeGoal')?.addEventListener('click', () => closeModal('goalModal'));
  document.getElementById('closeTask')?.addEventListener('click', () => closeModal('taskModal'));
  document.getElementById('cancelGoal')?.addEventListener('click', () => closeModal('goalModal'));
  document.getElementById('cancelTask')?.addEventListener('click', () => closeModal('taskModal'));
}

function setTheme(theme) {
  GoalApp.theme = theme;
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('goalmap-theme', theme);
}

function toggleTheme() {
  const newTheme = GoalApp.theme === 'light' ? 'dark' : 'light';
  setTheme(newTheme);
}

function checkAuth() {
  GoalApp.auth.onAuthStateChanged(function(user) {
    GoalApp.user = user;
    if (user) {
      updateUserUI(user);
      loadGoals();
    } else {
      resetUI();
      openModal('authModal');
    }
  });
}

function updateUserUI(user) {
  const name = user.displayName || user.email.split('@')[0];
  if (GoalApp.elems.userName) GoalApp.elems.userName.textContent = name;
  if (GoalApp.elems.userInitial) GoalApp.elems.userInitial.textContent = name.charAt(0).toUpperCase();
  if (GoalApp.elems.userSection) GoalApp.elems.userSection.style.display = 'flex';
}

function resetUI() {
  GoalApp.goals = [];
  GoalApp.currentGoal = null;
  GoalApp.pendingDelete = null;
  if (GoalApp.elems.userSection) GoalApp.elems.userSection.style.display = 'none';
  renderCards();
  renderTasks([]);
  updateProgress();
  updateStats();
}

async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;
  
  try {
    await GoalApp.auth.signInWithEmailAndPassword(email, password);
    showMessage('Вход выполнен');
    e.target.reset();
  } catch (err) {
    showMessage('Ошибка входа: ' + err.message, 'error');
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const email = document.getElementById('registerEmail').value;
  const password = document.getElementById('registerPassword').value;
  const name = document.getElementById('registerName').value;
  
  try {
    const userCred = await GoalApp.auth.createUserWithEmailAndPassword(email, password);
    await userCred.user.updateProfile({ displayName: name });
    showMessage('Регистрация успешна', 'success');
    e.target.reset();
    switchAuthTab('login');
  } catch (err) {
    showMessage('Ошибка: ' + err.message, 'error');
  }
}

async function logoutUser() {
  try {
    await GoalApp.auth.signOut();
    showMessage('Вы вышли из системы');
  } catch (err) {
    showMessage('Ошибка выхода', 'error');
  }
}

function switchAuthTab(tabId) {
  document.querySelectorAll('.auth-tab').forEach(tab => {
    tab.classList.remove('active');
  });
  document.querySelector(`.auth-tab[data-tab="${tabId}"]`)?.classList.add('active');
  
  document.querySelectorAll('.auth-form').forEach(form => {
    form.classList.remove('active');
  });
  document.getElementById(`${tabId}Form`)?.classList.add('active');
}

function switchWorkspaceView(view) {
  GoalApp.currentView = view;
  
  document.querySelectorAll('.workspace-tab').forEach(tab => {
    tab.classList.toggle('active', tab.getAttribute('data-view') === view);
  });
  
  document.querySelectorAll('.view-content').forEach(content => {
    content.classList.toggle('active', content.id === view + 'View');
  });
  
  if (view === 'cards') {
    renderCards();
  } else if (view === 'stats') {
    updateStats();
    renderStatsChart();
  }
}

function switchToCardsView() {
  GoalApp.currentGoal = null;
  if (GoalApp.elems.editGoalBtn) GoalApp.elems.editGoalBtn.style.display = 'none';
  switchWorkspaceView('cards');
}

async function loadGoals() {
  if (!GoalApp.user) return;
  
  try {
    const snapshot = await GoalApp.db.collection('goals')
      .where('ownerId', '==', GoalApp.user.uid)
      .orderBy('createdAt', 'desc')
      .get();
    
    GoalApp.goals = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      GoalApp.goals.push({
        id: doc.id,
        title: data.title || '',
        description: data.description || '',
        tasks: data.tasks || [],
        pinned: data.pinned || false,
        ownerId: data.ownerId,
        ownerName: data.ownerName,
        createdAt: data.createdAt?.toDate?.()?.getTime() || Date.now(),
        updatedAt: data.updatedAt?.toDate?.()?.getTime() || Date.now()
      });
    });
    
    sortGoalsByType();
    renderCards();
    updateStats();
    
  } catch (err) {
    showMessage('Ошибка загрузки целей: ' + err.message, 'error');
  }
}

function sortGoalsByType() {
  if (!GoalApp.goals.length) return;
  
  const sortBy = GoalApp.goalSort || 'newest';
  
  // Сначала разделяем на закрепленные и обычные
  const pinnedGoals = GoalApp.goals.filter(g => g.pinned);
  const unpinnedGoals = GoalApp.goals.filter(g => !g.pinned);
  
  // Сортируем каждую группу отдельно
  function sortGoalArray(goals) {
    return goals.sort((a, b) => {
      switch(sortBy) {
        case 'newest':
          return b.createdAt - a.createdAt;
          
        case 'oldest':
          return a.createdAt - b.createdAt;
          
        case 'progress':
          return calculateGoalProgress(a) - calculateGoalProgress(b);
          
        case 'progress_desc':
          return calculateGoalProgress(b) - calculateGoalProgress(a);
          
        case 'title':
          return a.title.localeCompare(b.title);
          
        case 'title_desc':
          return b.title.localeCompare(a.title);
          
        case 'pinned':
          // Для опции "Закрепленные сначала" закрепленные уже наверху
          return b.createdAt - a.createdAt;
          
        default:
          return b.createdAt - a.createdAt;
      }
    });
  }
  
  // Сортируем каждую группу и объединяем
  const sortedPinned = sortGoalArray(pinnedGoals);
  const sortedUnpinned = sortGoalArray(unpinnedGoals);
  
  // Закрепленные всегда наверху
  GoalApp.goals = [...sortedPinned, ...sortedUnpinned];
}

function sortGoals() {
  GoalApp.goalSort = GoalApp.elems.goalSort.value;
  sortGoalsByType();
  renderCards();
}

function renderCards() {
  const container = GoalApp.elems.cardsGrid;
  if (!container) return;
  
  container.innerHTML = '';
  
  if (GoalApp.goals.length === 0) {
    container.innerHTML = `
      <div class="empty-cards">
        <div class="empty-icon">🎯</div>
        <h3 class="empty-title">Целей пока нет</h3>
        <p class="empty-text">Создайте первую цель</p>
      </div>
    `;
    updateCardsStats();
    return;
  }
  
  let completedCount = 0;
  
  GoalApp.goals.forEach(goal => {
    const progress = calculateGoalProgress(goal);
    const tasks = getAllTasks(goal.tasks || []);
    const completedTasks = tasks.filter(t => t.completed).length;
    
    if (progress === 100) completedCount++;
    
    const card = document.createElement('div');
    card.className = `goal-card ${progress === 100 ? 'completed' : ''} ${goal.pinned ? 'pinned' : ''}`;
    card.dataset.goalId = goal.id;
    
    const date = new Date(goal.createdAt);
    const formattedDate = date.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
    
    card.innerHTML = `
      <div class="goal-card-header">
        <div class="goal-card-title">${escapeHtml(goal.title)}</div>
        <div class="goal-card-percent">${progress}%</div>
      </div>
      <div class="goal-card-desc">${escapeHtml(goal.description || 'Нет описания')}</div>
      
      <div class="goal-card-progress-section">
        <div class="goal-card-progress-info">
          <div class="goal-card-progress-stats">
            <span class="goal-card-tasks-count">${tasks.length} задач</span>
            <span class="goal-card-completed">${completedTasks} выполнено</span>
          </div>
          <div class="goal-card-progress-bar-container">
            <div class="goal-card-progress-track">
              <div class="goal-card-progress-fill" style="width: ${progress}%"></div>
            </div>
          </div>
        </div>
      </div>
      
      <div class="goal-card-actions">
        <button class="goal-card-btn pin ${goal.pinned ? 'active' : ''}" title="${goal.pinned ? 'Открепить' : 'Закрепить'}">${goal.pinned ? '📌' : '📍'}</button>
        <button class="goal-card-btn edit" title="Редактировать цель">✏️</button>
        <button class="goal-card-btn delete" title="Удалить цель">🗑️</button>
      </div>
      
      <div class="goal-card-date">Создано: ${formattedDate}</div>
    `;
    
    card.addEventListener('click', (e) => {
      if (!e.target.closest('.goal-card-btn')) {
        selectGoal(goal.id);
        GoalApp.currentView = 'detail';
        switchWorkspaceView('cards');
        setTimeout(() => {
          document.querySelectorAll('.view-content').forEach(content => {
            content.classList.remove('active');
          });
          document.getElementById('detailView').classList.add('active');
        }, 10);
      }
    });
    
    const pinBtn = card.querySelector('.goal-card-btn.pin');
    const editBtn = card.querySelector('.goal-card-btn.edit');
    const deleteBtn = card.querySelector('.goal-card-btn.delete');
    
    pinBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleGoalPin(goal.id);
    });
    
    editBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openGoalModal(goal.id);
    });
    
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      showDeleteConfirm('goal', goal.id, goal.title);
    });
    
    container.appendChild(card);
  });
  
  updateCardsStats(completedCount);
}

async function toggleGoalPin(goalId) {
  const goalIndex = GoalApp.goals.findIndex(g => g.id === goalId);
  if (goalIndex === -1) return;
  
  const newPinned = !GoalApp.goals[goalIndex].pinned;
  GoalApp.goals[goalIndex].pinned = newPinned;
  
  try {
    await GoalApp.db.collection('goals').doc(goalId).update({
      pinned: newPinned,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    sortGoalsByType();
    renderCards();
    showMessage(newPinned ? 'Цель закреплена' : 'Цель откреплена', 'info');
    
  } catch (err) {
    GoalApp.goals[goalIndex].pinned = !newPinned;
    showMessage('Ошибка обновления', 'error');
  }
}

function showDeleteConfirm(type, id, title) {
  GoalApp.pendingDelete = { type, id, title };
  
  if (GoalApp.elems.deleteConfirmMessage) {
    const message = type === 'goal' 
      ? `<p>Вы уверены, что хотите удалить цель <strong>"${title}"</strong>?</p>
         <p class="delete-warning">Все задачи будут удалены безвозвратно.</p>`
      : `<p>Вы уверены, что хотите удалить задачу <strong>"${title}"</strong>?</p>
         <p class="delete-warning">Все подзадачи также будут удалены.</p>`;
    
    GoalApp.elems.deleteConfirmMessage.innerHTML = message;
  }
  
  openModal('deleteConfirmModal');
}

async function deleteItemConfirmed() {
  if (!GoalApp.pendingDelete) return;
  
  const { type, id, title } = GoalApp.pendingDelete;
  
  try {
    if (type === 'goal') {
      await GoalApp.db.collection('goals').doc(id).delete();
      
      GoalApp.goals = GoalApp.goals.filter(g => g.id !== id);
      
      if (GoalApp.currentGoal?.id === id) {
        switchToCardsView();
      }
      
      renderCards();
      showMessage(`Цель "${title}" удалена`, 'info');
      
    } else if (type === 'task') {
      if (!GoalApp.currentGoal) return;
      
      function removeTaskById(tasks, taskId) {
        return tasks.filter(task => {
          if (task.id === taskId) return false;
          if (task.subtasks) {
            task.subtasks = removeTaskById(task.subtasks, taskId);
          }
          return true;
        });
      }
      
      const updatedTasks = removeTaskById(GoalApp.currentGoal.tasks, id);
      GoalApp.currentGoal.tasks = updatedTasks;
      
      await GoalApp.db.collection('goals').doc(GoalApp.currentGoal.id).update({
        tasks: updatedTasks,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      
      renderTasks(updatedTasks);
      updateProgress();
      sortGoalsByType();
      renderCards();
      showMessage(`Задача "${title}" удалена`, 'info');
    }
    
    closeModal('deleteConfirmModal');
    GoalApp.pendingDelete = null;
    updateStats();
    
  } catch (err) {
    showMessage('Ошибка удаления: ' + err.message, 'error');
    GoalApp.pendingDelete = null;
  }
}

function updateCardsStats(completedCount = 0) {
  if (GoalApp.elems.totalGoalsCount) {
    GoalApp.elems.totalGoalsCount.textContent = GoalApp.goals.length;
  }
  if (GoalApp.elems.completedGoalsCount) {
    GoalApp.elems.completedGoalsCount.textContent = completedCount;
  }
}

function openGoalModal(goalId = null) {
  GoalApp.editingGoalId = goalId;
  
  const form = GoalApp.elems.goalForm;
  if (form) form.reset();
  
  if (goalId) {
    const goal = GoalApp.goals.find(g => g.id === goalId);
    if (goal) {
      document.getElementById('goalTitle').value = goal.title;
      document.getElementById('goalDesc').value = goal.description || '';
    }
    if (GoalApp.elems.goalModalTitle) GoalApp.elems.goalModalTitle.textContent = '✏️ Редактировать цель';
    if (GoalApp.elems.goalSubmitBtn) GoalApp.elems.goalSubmitBtn.textContent = 'Обновить цель';
  } else {
    if (GoalApp.elems.goalModalTitle) GoalApp.elems.goalModalTitle.textContent = '🎯 Новая цель';
    if (GoalApp.elems.goalSubmitBtn) GoalApp.elems.goalSubmitBtn.textContent = 'Создать цель';
  }
  
  openModal('goalModal');
}

async function handleGoalForm(e) {
  e.preventDefault();
  
  const title = document.getElementById('goalTitle').value.trim();
  const description = document.getElementById('goalDesc').value.trim();
  
  if (!title) {
    showMessage('Введите название цели', 'error');
    return;
  }
  
  try {
    const goalData = {
      title: title,
      description: description,
      pinned: false,
      ownerId: GoalApp.user.uid,
      ownerName: GoalApp.user.displayName || GoalApp.user.email,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    if (GoalApp.editingGoalId) {
      const existingGoal = GoalApp.goals.find(g => g.id === GoalApp.editingGoalId);
      if (existingGoal) {
        goalData.tasks = existingGoal.tasks || [];
        goalData.pinned = existingGoal.pinned || false;
      }
      
      await GoalApp.db.collection('goals').doc(GoalApp.editingGoalId).update(goalData);
      
      const index = GoalApp.goals.findIndex(g => g.id === GoalApp.editingGoalId);
      if (index !== -1) {
        GoalApp.goals[index] = {
          ...GoalApp.goals[index],
          ...goalData,
          id: GoalApp.editingGoalId
        };
      }
      
      if (GoalApp.currentGoal?.id === GoalApp.editingGoalId) {
        GoalApp.currentGoal = GoalApp.goals[index];
        updateCurrentGoalUI();
      }
      
      showMessage('Цель обновлена', 'success');
    } else {
      goalData.tasks = [];
      goalData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      
      const docRef = await GoalApp.db.collection('goals').add(goalData);
      
      const newGoal = {
        id: docRef.id,
        ...goalData,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      
      GoalApp.goals.unshift(newGoal);
      showMessage('Цель создана', 'success');
    }
    
    closeModal('goalModal');
    sortGoalsByType();
    renderCards();
    updateStats();
    
  } catch (err) {
    showMessage('Ошибка: ' + err.message, 'error');
  }
}

function selectGoal(goalId) {
  const goal = GoalApp.goals.find(g => g.id === goalId);
  if (!goal) return;
  
  GoalApp.currentGoal = goal;
  
  if (GoalApp.elems.currentGoalTitle) {
    GoalApp.elems.currentGoalTitle.textContent = goal.title;
  }
  
  if (GoalApp.elems.goalDescription) {
    GoalApp.elems.goalDescription.textContent = goal.description || '';
    GoalApp.elems.goalDescription.style.display = goal.description ? 'block' : 'none';
  }
  
  if (GoalApp.elems.editGoalBtn) {
    GoalApp.elems.editGoalBtn.style.display = 'block';
  }
  
  renderTasks(goal.tasks || []);
  updateProgress();
}

function calculateGoalProgress(goal) {
  if (!goal.tasks || goal.tasks.length === 0) return 0;
  
  const allTasks = getAllTasks(goal.tasks);
  const completed = allTasks.filter(t => t.completed).length;
  return allTasks.length > 0 ? Math.round((completed / allTasks.length) * 100) : 0;
}

function updateCurrentGoalUI() {
  if (!GoalApp.currentGoal) return;
  
  if (GoalApp.elems.currentGoalTitle) {
    GoalApp.elems.currentGoalTitle.textContent = GoalApp.currentGoal.title;
  }
  
  if (GoalApp.elems.goalDescription) {
    GoalApp.elems.goalDescription.textContent = GoalApp.currentGoal.description || '';
  }
}

function setupTaskHover() {
    const taskItems = document.querySelectorAll('.task-item');
    
    taskItems.forEach(task => {
        task.addEventListener('mouseenter', function(e) {
            e.stopPropagation();
            
            document.querySelectorAll('.task-actions').forEach(actions => {
                actions.style.opacity = '0';
            });
            
            const currentActions = this.querySelector('.task-actions');
            if (currentActions) {
                currentActions.style.opacity = '1';
            }
        });
    });
    
    tasksContainer.addEventListener('mouseleave', function() {
        document.querySelectorAll('.task-actions').forEach(actions => {
            actions.style.opacity = '0';
        });
    });
}

function renderTasks(tasks) {
    const container = GoalApp.elems.tasksContainer;
    if (!container) return;
    
    container.innerHTML = '';
    
    if (!tasks || tasks.length === 0) {
        container.innerHTML = `
            <div class="empty-workspace">
                <div class="empty-icon">📋</div>
                <h3 class="empty-title">Задач пока нет</h3>
                <p class="empty-text">Добавьте задачи к выбранной цели</p>
            </div>
        `;
        return;
    }
    
    if (GoalApp.elems.taskSort) {
        const sortBy = GoalApp.elems.taskSort.value;
        if (sortBy !== 'default') {
            tasks = sortTasksByType([...tasks], sortBy);
        }
    }
    
    const fragment = document.createDocumentFragment();
    
    tasks.forEach(task => {
        const taskElement = createTaskElement(task, 0);
        if (taskElement) {
            fragment.appendChild(taskElement);
        }
    });
    
    container.appendChild(fragment);
    
    setupTaskHover();
}

function sortTasksByType(tasks, sortBy) {
  switch(sortBy) {
    case 'completed':
      return tasks.sort((a, b) => {
        if (a.completed && !b.completed) return -1;
        if (!a.completed && b.completed) return 1;
        return 0;
      });
      
    case 'active':
      return tasks.sort((a, b) => {
        if (!a.completed && b.completed) return -1;
        if (a.completed && !b.completed) return 1;
        return 0;
      });
      
    case 'title':
      return tasks.sort((a, b) => a.title.localeCompare(b.title));
      
    case 'title_desc':
      return tasks.sort((a, b) => b.title.localeCompare(a.title));
      
    default:
      return tasks;
  }
}

function sortTasks() {
  if (!GoalApp.currentGoal) return;
  renderTasks(GoalApp.currentGoal.tasks || []);
}

function createTaskElement(task, level) {
  if (!task) return null;
  
  const taskEl = document.createElement('div');
  taskEl.className = `task-item ${task.completed ? 'completed' : ''}`;
  taskEl.dataset.taskId = task.id;
  
  taskEl.innerHTML = `
    <div class="task-header">
      <input type="checkbox" class="task-checkbox" 
        ${task.completed ? 'checked' : ''}>
      <div class="task-title">${escapeHtml(task.title)}</div>
      <div class="task-actions">
        <button class="task-action-btn" title="Добавить подзадачу">+</button>
        <button class="task-action-btn" title="Редактировать">✏️</button>
        <button class="task-action-btn" title="Удалить">🗑️</button>
      </div>
    </div>
    ${task.description ? `<div class="task-description">${escapeHtml(task.description)}</div>` : ''}
  `;
  
  const checkbox = taskEl.querySelector('.task-checkbox');
  const buttons = taskEl.querySelectorAll('.task-action-btn');
  
  if (checkbox) {
    checkbox.addEventListener('change', () => {
      toggleTaskComplete(task.id, checkbox.checked);
    });
  }
  
  if (buttons[0]) {
    buttons[0].addEventListener('click', (e) => {
      e.stopPropagation();
      openTaskModal(null, task.id);
    });
  }
  
  if (buttons[1]) {
    buttons[1].addEventListener('click', (e) => {
      e.stopPropagation();
      openTaskModal(task.id);
    });
  }
  
  if (buttons[2]) {
    buttons[2].addEventListener('click', (e) => {
      e.stopPropagation();
      showDeleteConfirm('task', task.id, task.title);
    });
  }
  
  if (task.subtasks && task.subtasks.length > 0) {
    const subtasksContainer = document.createElement('div');
    subtasksContainer.className = 'subtasks';
    
    task.subtasks.forEach(subtask => {
      const subtaskElement = createTaskElement(subtask, level + 1);
      if (subtaskElement) {
        subtasksContainer.appendChild(subtaskElement);
      }
    });
    
    taskEl.appendChild(subtasksContainer);
  }
  
  return taskEl;
}

function openTaskModal(taskId = null, parentId = null) {
  if (!GoalApp.currentGoal) {
    showMessage('Сначала выберите цель', 'error');
    return;
  }
  
  const form = GoalApp.elems.taskForm;
  if (form) form.reset();
  
  const modalTitle = document.getElementById('taskModalTitle');
  const submitBtn = document.getElementById('taskSubmitBtn');
  
  if (taskId) {
    const task = findTaskById(GoalApp.currentGoal.tasks, taskId);
    if (task) {
      document.getElementById('taskTitle').value = task.title;
      document.getElementById('taskDesc').value = task.description || '';
    }
    if (modalTitle) modalTitle.textContent = '✏️ Редактировать задачу';
    if (submitBtn) submitBtn.textContent = 'Обновить задачу';
  } else {
    if (modalTitle) modalTitle.textContent = '📋 Новая задача';
    if (submitBtn) submitBtn.textContent = 'Добавить задачу';
  }
  
  fillParentSelect(taskId);
  
  if (parentId) {
    document.getElementById('taskParent').value = parentId;
  }
  
  GoalApp.editingTaskId = taskId;
  openModal('taskModal');
}

function fillParentSelect(excludeTaskId = null) {
  const select = document.getElementById('taskParent');
  if (!select) return;
  
  select.innerHTML = '<option value="">Основная задача</option>';
  
  function addOptions(tasks, level = 0) {
    tasks.forEach(task => {
      if (task.id !== excludeTaskId && !task.completed) {
        const indent = '— '.repeat(level);
        const option = document.createElement('option');
        option.value = task.id;
        option.textContent = indent + task.title;
        select.appendChild(option);
        
        if (task.subtasks) {
          addOptions(task.subtasks, level + 1);
        }
      }
    });
  }
  
  addOptions(GoalApp.currentGoal?.tasks || []);
}

async function handleTaskForm(e) {
  e.preventDefault();
  
  const title = document.getElementById('taskTitle').value.trim();
  const description = document.getElementById('taskDesc').value.trim();
  const parentId = document.getElementById('taskParent').value;
  
  if (!title) {
    showMessage('Введите название задачи', 'error');
    return;
  }
  
  try {
    const taskData = {
      id: GoalApp.editingTaskId || 'task_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      title: title,
      description: description,
      completed: false,
      subtasks: []
    };
    
    if (GoalApp.editingTaskId) {
      const existingTask = findTaskById(GoalApp.currentGoal.tasks, GoalApp.editingTaskId);
      if (existingTask) {
        taskData.completed = existingTask.completed;
        taskData.subtasks = existingTask.subtasks || [];
      }
    }
    
    let updatedTasks;
    if (GoalApp.editingTaskId) {
      updatedTasks = updateTaskInArray([...GoalApp.currentGoal.tasks], GoalApp.editingTaskId, taskData);
    } else if (parentId) {
      updatedTasks = addTaskAsSubtask([...GoalApp.currentGoal.tasks], parentId, taskData);
    } else {
      updatedTasks = [...(GoalApp.currentGoal.tasks || []), taskData];
    }
    
    GoalApp.currentGoal.tasks = updatedTasks;
    
    await GoalApp.db.collection('goals').doc(GoalApp.currentGoal.id).update({
      tasks: updatedTasks,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    const goalIndex = GoalApp.goals.findIndex(g => g.id === GoalApp.currentGoal.id);
    if (goalIndex !== -1) {
      GoalApp.goals[goalIndex].tasks = updatedTasks;
    }
    
    renderTasks(updatedTasks);
    updateProgress();
    sortGoalsByType();
    renderCards();
    closeModal('taskModal');
    
    showMessage(GoalApp.editingTaskId ? 'Задача обновлена' : 'Задача создана', 'success');
    GoalApp.editingTaskId = null;
    updateStats();
    
  } catch (err) {
    showMessage('Ошибка: ' + err.message, 'error');
  }
}

function findTaskById(tasks, taskId) {
  for (const task of tasks) {
    if (task.id === taskId) return task;
    if (task.subtasks) {
      const found = findTaskById(task.subtasks, taskId);
      if (found) return found;
    }
  }
  return null;
}

function updateTaskInArray(tasks, taskId, newData) {
  return tasks.map(task => {
    if (task.id === taskId) {
      return { ...task, ...newData };
    }
    if (task.subtasks) {
      return {
        ...task,
        subtasks: updateTaskInArray(task.subtasks, taskId, newData)
      };
    }
    return task;
  });
}

function addTaskAsSubtask(tasks, parentId, subtask) {
  return tasks.map(task => {
    if (task.id === parentId) {
      return {
        ...task,
        subtasks: [...(task.subtasks || []), subtask]
      };
    }
    if (task.subtasks) {
      return {
        ...task,
        subtasks: addTaskAsSubtask(task.subtasks, parentId, subtask)
      };
    }
    return task;
  });
}

async function toggleTaskComplete(taskId, completed) {
  if (!GoalApp.currentGoal) return;
  
  const task = findTaskById(GoalApp.currentGoal.tasks, taskId);
  if (!task) return;
  
  const taskElement = document.querySelector(`[data-task-id="${taskId}"]`);
  const checkbox = taskElement?.querySelector('.task-checkbox');
  
  if (completed) {
    let hasIncomplete = false;
    if (task.subtasks && task.subtasks.length > 0) {
      hasIncomplete = task.subtasks.some(st => !st.completed);
    }
    
    if (hasIncomplete) {
      if (taskElement) {
        const existingWarning = taskElement.querySelector('.task-warning');
        if (existingWarning) existingWarning.remove();
        
        const warning = document.createElement('div');
        warning.className = 'task-warning';
        warning.textContent = '⚠️ Сначала завершите все подзадачи';
        
        const taskHeader = taskElement.querySelector('.task-header');
        if (taskHeader) {
          taskHeader.parentNode.insertBefore(warning, taskHeader.nextSibling);
        } else {
          taskElement.insertBefore(warning, taskElement.firstChild);
        }
        
        setTimeout(() => {
          if (warning.parentNode) warning.remove();
        }, 3000);
      }
      
      if (checkbox) checkbox.checked = false;
      showMessage('Сначала завершите все подзадачи!', 'error');
      return;
    }
    
    if (task.subtasks) {
      completeAllSubtasks(task.subtasks);
    }
  } else {
    if (task.completed) {
      task.completed = false;
    }
    
    const parentTask = findParentTask(GoalApp.currentGoal.tasks, taskId);
    if (parentTask && parentTask.completed) {
      parentTask.completed = false;
    }
  }
  
  task.completed = completed;
  
  try {
    await GoalApp.db.collection('goals').doc(GoalApp.currentGoal.id).update({
      tasks: GoalApp.currentGoal.tasks,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    renderTasks(GoalApp.currentGoal.tasks);
    updateProgress();
    sortGoalsByType();
    renderCards();
    updateStats();
    
  } catch (err) {
    if (checkbox) checkbox.checked = !completed;
    task.completed = !completed;
    showMessage('Ошибка обновления', 'error');
  }
}

function findParentTask(tasks, childTaskId, parent = null) {
  for (const task of tasks) {
    if (task.id === childTaskId) {
      return parent;
    }
    if (task.subtasks) {
      const found = findParentTask(task.subtasks, childTaskId, task);
      if (found) return found;
    }
  }
  return null;
}

function completeAllSubtasks(subtasks) {
  subtasks.forEach(st => {
    st.completed = true;
    if (st.subtasks) completeAllSubtasks(st.subtasks);
  });
}

function updateProgress() {
  if (!GoalApp.currentGoal) {
    if (GoalApp.elems.progressPercent) GoalApp.elems.progressPercent.textContent = '0%';
    if (GoalApp.elems.progressBar) GoalApp.elems.progressBar.style.width = '0%';
    if (GoalApp.elems.completedTasks) GoalApp.elems.completedTasks.textContent = '0';
    if (GoalApp.elems.totalTasks) GoalApp.elems.totalTasks.textContent = '0';
    return;
  }
  
  const progress = calculateGoalProgress(GoalApp.currentGoal);
  const allTasks = getAllTasks(GoalApp.currentGoal.tasks || []);
  const completed = allTasks.filter(t => t.completed).length;
  
  if (GoalApp.elems.progressPercent) {
    GoalApp.elems.progressPercent.textContent = `${progress}%`;
  }
  
  if (GoalApp.elems.progressBar) {
    GoalApp.elems.progressBar.style.width = `${progress}%`;
  }
  
  if (GoalApp.elems.completedTasks) {
    GoalApp.elems.completedTasks.textContent = completed;
  }
  
  if (GoalApp.elems.totalTasks) {
    GoalApp.elems.totalTasks.textContent = allTasks.length;
  }
}

function updateStats() {
  const totalGoals = GoalApp.goals.length;
  const completedGoals = GoalApp.goals.filter(g => calculateGoalProgress(g) === 100).length;
  
  let totalTasks = 0;
  let completedTasks = 0;
  
  GoalApp.goals.forEach(goal => {
    const tasks = getAllTasks(goal.tasks || []);
    totalTasks += tasks.length;
    completedTasks += tasks.filter(t => t.completed).length;
  });
  
  const productivity = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  
  if (GoalApp.elems.totalGoalsStat) GoalApp.elems.totalGoalsStat.textContent = totalGoals;
  if (GoalApp.elems.completedGoalsStat) GoalApp.elems.completedGoalsStat.textContent = completedGoals;
  if (GoalApp.elems.totalTasksStat) GoalApp.elems.totalTasksStat.textContent = totalTasks;
  if (GoalApp.elems.productivityStat) GoalApp.elems.productivityStat.textContent = `${productivity}%`;
}

function renderStatsChart() {
  const container = document.getElementById('progressChart');
  if (!container) return;
  
  const goals = GoalApp.goals.slice(0, 10);
  if (goals.length === 0) {
    container.innerHTML = '<p class="empty-text">Нет данных для отображения</p>';
    return;
  }
  
  let html = '<div class="chart-bars">';
  
  goals.forEach(goal => {
    const progress = calculateGoalProgress(goal);
    
    html += `
      <div class="chart-bar-item">
        <div class="chart-bar-label">${escapeHtml(goal.title)}</div>
        <div class="chart-bar-track">
          <div class="chart-bar-fill" style="width: ${progress}%"></div>
        </div>
        <div class="chart-bar-value">${progress}%</div>
      </div>
    `;
  });
  
  html += '</div>';
  container.innerHTML = html;
  
  setTimeout(() => {
    const fills = container.querySelectorAll('.chart-bar-fill');
    fills.forEach(fill => {
      const width = fill.style.width;
      fill.style.width = '0%';
      setTimeout(() => {
        fill.style.transition = 'width 0.5s ease-out';
        fill.style.width = width;
      }, 10);
    });
  }, 100);
}

function getAllTasks(tasks) {
  let result = [];
  
  function collect(tasksList) {
    tasksList.forEach(task => {
      result.push(task);
      if (task.subtasks) collect(task.subtasks);
    });
  }
  
  collect(tasks || []);
  return result;
}

function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.style.display = 'none';
    document.body.style.overflow = '';
    
    if (modalId === 'goalModal') {
      GoalApp.editingGoalId = null;
    } else if (modalId === 'taskModal') {
      GoalApp.editingTaskId = null;
    } else if (modalId === 'deleteConfirmModal') {
      GoalApp.pendingDelete = null;
    }
  }
}

function showMessage(message, type = 'info') {
  const container = document.getElementById('notifications');
  if (!container) return;
  
  const alert = document.createElement('div');
  alert.className = `notification ${type}`;
  alert.innerHTML = `
    <span>${type === 'error' ? '⚠️' : type === 'success' ? '✅' : 'ℹ️'}</span>
    <span>${message}</span>
  `;
  
  container.appendChild(alert);
  
  setTimeout(() => {
    alert.style.opacity = '0';
    setTimeout(() => alert.remove(), 300);
  }, 2000);
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

document.addEventListener('touchstart', function() {}, {passive: true});

document.addEventListener('click', function(e) {
    if (e.target.matches('.goal-card-btn, .task-action-btn, .workspace-tab')) {
        e.preventDefault();
        e.target.classList.add('active');
        setTimeout(() => e.target.classList.remove('active'), 200);
    }
}, true);
