

/* =====================================================
   STORAGE
===================================================== */

const TASK_KEY = "focusFlow_tasks_v3";
const SETTINGS_KEY = "focusFlow_settings_v3";
const HISTORY_KEY = "focusFlow_history_v3";


let tasks =
    JSON.parse(localStorage.getItem(TASK_KEY)) || [];

let settings =
    JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {
        dark: false,
        dailyGoal: 5,
        streak: 0,
        lastCompletedDay: null,
        focusMinutes: 0
    };

let history =
    JSON.parse(localStorage.getItem(HISTORY_KEY)) || {};


/* =====================================================
   STATE
===================================================== */

let selectedDate = todayString();

let editingId = null;

let timerSeconds = 25 * 60;
let timerInterval = null;
let timerRunning = false;

let selectedRepeatDays = [];


/* =====================================================
   ELEMENTS
===================================================== */

const taskInput =
    document.getElementById("taskInput");

const priorityInput =
    document.getElementById("priorityInput");

const taskList =
    document.getElementById("taskList");

const search =
    document.getElementById("search");

const filter =
    document.getElementById("filter");

const sort =
    document.getElementById("sort");


/* =====================================================
   DATE FUNCTIONS
===================================================== */

function todayString() {

    const d = new Date();

    return formatDateKey(d);
}


function formatDateKey(date) {

    const year =
        date.getFullYear();

    const month =
        String(date.getMonth() + 1)
            .padStart(2, "0");

    const day =
        String(date.getDate())
            .padStart(2, "0");

    return `${year}-${month}-${day}`;
}


function dateFromKey(key) {

    const parts = key.split("-");

    return new Date(
        Number(parts[0]),
        Number(parts[1]) - 1,
        Number(parts[2])
    );

}


function formatReadableDate(key) {

    const date =
        dateFromKey(key);

    return date.toLocaleDateString(
        undefined,
        {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric"
        }
    );

}


function addDays(key, amount) {

    const date =
        dateFromKey(key);

    date.setDate(
        date.getDate() + amount
    );

    return formatDateKey(date);

}


/* =====================================================
   SAVE
===================================================== */

function save() {

    localStorage.setItem(
        TASK_KEY,
        JSON.stringify(tasks)
    );

    localStorage.setItem(
        SETTINGS_KEY,
        JSON.stringify(settings)
    );

    localStorage.setItem(
        HISTORY_KEY,
        JSON.stringify(history)
    );

}


/* =====================================================
   DAILY SYSTEM
===================================================== */

/*
    This is the important part.

    Every time the app opens, it checks the date.

    If today's recurring tasks don't exist yet,
    they are automatically generated.

    Unfinished carry-over tasks are also copied.
*/

function prepareDay() {

    const today =
        todayString();

    generateRecurringTasks(today);

    carryOverTasks(today);

    cleanOldGeneratedDuplicates();

    save();

}


/* =====================================================
   RECURRING TASKS
===================================================== */

function generateRecurringTasks(dateKey) {

    const date =
        dateFromKey(dateKey);

    const day =
        date.getDay();


    const recurringTemplates =
        tasks.filter(
            task =>
                task.recurring === true &&
                task.template === true
        );


    recurringTemplates.forEach(template => {

        if (
            !shouldRepeatOnDay(
                template,
                day
            )
        ) {
            return;
        }


        const alreadyExists =
            tasks.some(
                task =>
                    task.templateId ===
                        template.id &&
                    task.date ===
                        dateKey
            );


        if (alreadyExists) {
            return;
        }


        tasks.push({

            id: createId(),

            title: template.title,

            priority: template.priority,

            completed: false,

            createdAt:
                new Date().toISOString(),

            completedAt: null,

            due: template.due
                ? dateKey +
                  template.due.substring(10)
                : "",

            category:
                template.category,

            notes:
                template.notes,

            pinned: false,

            date: dateKey,

            templateId:
                template.id,

            recurring: true,

            template: false,

            generated: true

        });

    });

}


function shouldRepeatOnDay(
    template,
    day
) {

    if (
        template.repeatType ===
        "daily"
    ) {
        return true;
    }


    if (
        template.repeatType ===
        "weekdays"
    ) {

        return day >= 1 &&
               day <= 5;

    }


    if (
        template.repeatType ===
        "weekly"
    ) {

        const original =
            dateFromKey(
                template.createdDate
            );

        return original.getDay() === day;

    }


    if (
        template.repeatType ===
        "custom"
    ) {

        return (
            template.repeatDays ||
            []
        ).includes(day);

    }


    return false;

}


/* =====================================================
   CARRY OVER
===================================================== */

function carryOverTasks(today) {

    const yesterday =
        addDays(today, -1);


    const yesterdayTasks =
        tasks.filter(
            task =>
                task.date === yesterday &&
                !task.completed &&
                !task.template
        );


    yesterdayTasks.forEach(oldTask => {

        const alreadyMoved =
            tasks.some(
                task =>
                    task.carryFrom ===
                        oldTask.id &&
                    task.date ===
                        today
            );


        if (alreadyMoved) {
            return;
        }


        tasks.push({

            ...oldTask,

            id: createId(),

            date: today,

            createdAt:
                new Date().toISOString(),

            carryFrom:
                oldTask.id,

            completed: false,

            completedAt: null,

            generated: false

        });

    });

}


/* =====================================================
   REMOVE DUPLICATE GENERATED TASKS
===================================================== */

function cleanOldGeneratedDuplicates() {

    const seen = new Set();

    tasks = tasks.filter(task => {

        if (
            !task.generated
        ) {
            return true;
        }


        const key =
            `${task.templateId}_${task.date}`;


        if (seen.has(key)) {
            return false;
        }


        seen.add(key);

        return true;

    });

}


/* =====================================================
   CREATE TASK
===================================================== */

function createId() {

    return Date.now() +
        "_" +
        Math.random()
            .toString(36)
            .substring(2);

}


function addNormalTask() {

    const title =
        taskInput.value.trim();


    if (!title) {

        showToast(
            "Write a task first."
        );

        return;

    }


    tasks.push({

        id: createId(),

        title,

        priority:
            priorityInput.value,

        completed: false,

        completedAt: null,

        createdAt:
            new Date().toISOString(),

        due: "",

        category: "Other",

        notes: "",

        pinned: false,

        date: selectedDate,

        recurring: false,

        template: false,

        generated: false

    });


    taskInput.value = "";

    save();

    render();

    showToast(
        "Task added 🚀"
    );

}


document.getElementById(
    "addBtn"
).onclick = addNormalTask;


taskInput.addEventListener(
    "keydown",
    e => {

        if (
            e.key === "Enter"
        ) {
            addNormalTask();
        }

    }
);


/* =====================================================
   GET CURRENT DAY TASKS
===================================================== */

function getDayTasks() {

    return tasks.filter(
        task =>
            task.date ===
            selectedDate &&
            !task.template
    );

}


/* =====================================================
   COMPLETE
===================================================== */

function toggleTask(id) {

    const task =
        tasks.find(
            t => t.id === id
        );


    if (!task) return;


    task.completed =
        !task.completed;


    if (task.completed) {

        task.completedAt =
            new Date().toISOString();

        updateStreak();

        showToast(
            "Completed! 🔥"
        );

    } else {

        task.completedAt = null;

    }


    save();

    render();

}


/* =====================================================
   DELETE
===================================================== */

function deleteTask(id) {

    const task =
        tasks.find(
            t => t.id === id
        );


    if (!task) return;


    if (
        task.recurring &&
        task.template
    ) {

        const confirmDelete =
            confirm(
                "Delete this recurring task permanently?"
            );

        if (!confirmDelete)
            return;

        tasks =
            tasks.filter(
                t =>
                    t.id !== id &&
                    t.templateId !== id
            );

    } else {

        const confirmDelete =
            confirm(
                "Delete this task?"
            );

        if (!confirmDelete)
            return;

        tasks =
            tasks.filter(
                t => t.id !== id
            );

    }


    save();

    render();

}


/* =====================================================
   PIN
===================================================== */

function togglePin(id) {

    const task =
        tasks.find(
            t => t.id === id
        );

    if (!task) return;

    task.pinned =
        !task.pinned;

    save();

    render();

}


/* =====================================================
   EDIT MODAL
===================================================== */

const modal =
    document.getElementById(
        "taskModal"
    );


function openEdit(id) {

    const task =
        tasks.find(
            t => t.id === id
        );


    if (!task) return;


    editingId = id;


    document.getElementById(
        "modalTitle"
    ).textContent =
        "Edit Task";


    document.getElementById(
        "editTitle"
    ).value =
        task.title;


    document.getElementById(
        "editDue"
    ).value =
        task.due || "";


    document.getElementById(
        "editCategory"
    ).value =
        task.category || "Other";


    document.getElementById(
        "editNotes"
    ).value =
        task.notes || "";


    document.getElementById(
        "editRecurring"
    ).checked =
        task.recurring &&
        task.template;


    if (
        task.recurring &&
        task.template
    ) {

        showRepeatOptions();

        document.getElementById(
            "repeatType"
        ).value =
            task.repeatType || "daily";


        selectedRepeatDays =
            task.repeatDays || [];


        updateDayButtons();

    } else {

        hideRepeatOptions();

    }


    modal.classList.add("show");

}


function closeModal() {

    modal.classList.remove(
        "show"
    );

    editingId = null;

}


document.getElementById(
    "closeModal"
).onclick = closeModal;


document.getElementById(
    "cancelModal"
).onclick = closeModal;


/* =====================================================
   SAVE EDIT
===================================================== */

document.getElementById(
    "saveTask"
).onclick = function() {

    const title =
        document.getElementById(
            "editTitle"
        ).value.trim();


    if (!title) {

        showToast(
            "Task name cannot be empty."
        );

        return;

    }


    const task =
        tasks.find(
            t => t.id === editingId
        );


    if (!task) return;


    task.title = title;

    task.due =
        document.getElementById(
            "editDue"
        ).value;

    task.category =
        document.getElementById(
            "editCategory"
        ).value;

    task.notes =
        document.getElementById(
            "editNotes"
        ).value;


    const recurring =
        document.getElementById(
            "editRecurring"
        ).checked;


    if (
        recurring &&
        !task.template
    ) {

        task.recurring = true;
        task.template = true;
        task.createdDate =
            selectedDate;

        task.repeatType =
            document.getElementById(
                "repeatType"
            ).value;

        task.repeatDays =
            [...selectedRepeatDays];

    }


    if (
        recurring &&
        task.template
    ) {

        task.repeatType =
            document.getElementById(
                "repeatType"
            ).value;

        task.repeatDays =
            [...selectedRepeatDays];

    }


    if (!recurring) {

        task.recurring = false;

        task.template = false;

    }


    save();

    closeModal();

    prepareDay();

    render();

    showToast(
        "Task saved."
    );

};


/* =====================================================
   RECURRING TASK CREATOR
===================================================== */

document.getElementById(
    "recurringBtn"
).onclick = function() {

    editingId = null;

    document.getElementById(
        "modalTitle"
    ).textContent =
        "Create Recurring Task";


    document.getElementById(
        "editTitle"
    ).value = "";


    document.getElementById(
        "editDue"
    ).value = "";


    document.getElementById(
        "editCategory"
    ).value =
        "Other";


    document.getElementById(
        "editNotes"
    ).value = "";


    document.getElementById(
        "editRecurring"
    ).checked = true;


    selectedRepeatDays = [];

    document.getElementById(
        "repeatType"
    ).value = "daily";


    showRepeatOptions();

    modal.classList.add(
        "show"
    );

};


/* =====================================================
   RECURRING MODAL SPECIAL SAVE
===================================================== */

const originalSaveButton =
    document.getElementById(
        "saveTask"
    );


/*
    Override save for new recurring tasks.
*/

originalSaveButton.addEventListener(
    "click",
    function() {

        if (editingId !== null)
            return;

        const title =
            document.getElementById(
                "editTitle"
            ).value.trim();


        if (!title) return;


        const recurring =
            document.getElementById(
                "editRecurring"
            ).checked;


        if (!recurring)
            return;


        const template = {

            id: createId(),

            title,

            priority:
                priorityInput.value,

            completed: false,

            completedAt: null,

            createdAt:
                new Date().toISOString(),

            due:
                document.getElementById(
                    "editDue"
                ).value,

            category:
                document.getElementById(
                    "editCategory"
                ).value,

            notes:
                document.getElementById(
                    "editNotes"
                ).value,

            pinned: false,

            date: selectedDate,

            recurring: true,

            template: true,

            createdDate:
                selectedDate,

            repeatType:
                document.getElementById(
                    "repeatType"
                ).value,

            repeatDays:
                [...selectedRepeatDays]

        };


        tasks.push(template);

        save();

        closeModal();

        prepareDay();

        render();

        showToast(
            "Recurring task created 🔄"
        );

    }
);


/* =====================================================
   REPEAT OPTIONS
===================================================== */

function showRepeatOptions() {

    document.getElementById(
        "repeatOptions"
    ).style.display =
        "block";

    updateCustomDays();

}


function hideRepeatOptions() {

    document.getElementById(
        "repeatOptions"
    ).style.display =
        "none";

}


document.getElementById(
    "editRecurring"
).onchange = function() {

    if (this.checked) {

        showRepeatOptions();

    } else {

        hideRepeatOptions();

    }

};


function updateCustomDays() {

    const type =
        document.getElementById(
            "repeatType"
        ).value;


    document.getElementById(
        "customDays"
    ).style.display =
        type === "custom"
            ? "block"
            : "none";

}


document.getElementById(
    "repeatType"
).onchange =
    updateCustomDays;


document.querySelectorAll(
    ".day-btn"
).forEach(
    button => {

        button.onclick =
            function() {

                const day =
                    Number(
                        this.dataset.day
                    );


                if (
                    selectedRepeatDays
                        .includes(day)
                ) {

                    selectedRepeatDays =
                        selectedRepeatDays
                            .filter(
                                d => d !== day
                            );

                } else {

                    selectedRepeatDays.push(
                        day
                    );

                }


                updateDayButtons();

            };

    }
);


function updateDayButtons() {

    document.querySelectorAll(
        ".day-btn"
    ).forEach(
        button => {

            const day =
                Number(
                    button.dataset.day
                );


            button.classList.toggle(
                "selected",
                selectedRepeatDays
                    .includes(day)
            );

        }
    );

}


/* =====================================================
   RENDER
===================================================== */

function render() {

    const dayTasks =
        getDayTasks();


    let visible =
        [...dayTasks];


    const query =
        search.value
            .toLowerCase()
            .trim();


    if (query) {

        visible =
            visible.filter(
                task =>
                    task.title
                        .toLowerCase()
                        .includes(query)
            );

    }


    switch (filter.value) {

        case "active":

            visible =
                visible.filter(
                    task =>
                        !task.completed
                );

            break;


        case "completed":

            visible =
                visible.filter(
                    task =>
                        task.completed
                );

            break;


        case "high":

            visible =
                visible.filter(
                    task =>
                        task.priority ===
                        "high"
                );

            break;


        case "overdue":

            visible =
                visible.filter(
                    isOverdue
                );

            break;


        case "recurring":

            visible =
                visible.filter(
                    task =>
                        task.recurring
                );

            break;

    }


    if (sort.value === "priority") {

        const order = {
            high: 1,
            medium: 2,
            low: 3
        };

        visible.sort(
            (a,b) =>
                order[a.priority] -
                order[b.priority]
        );

    }


    if (sort.value === "created") {

        visible.sort(
            (a,b) =>
                new Date(b.createdAt) -
                new Date(a.createdAt)
        );

    }


    if (sort.value === "due") {

        visible.sort(
            (a,b) => {

                if (!a.due) return 1;
                if (!b.due) return -1;

                return new Date(a.due) -
                    new Date(b.due);

            }
        );

    }


    if (sort.value === "alphabetical") {

        visible.sort(
            (a,b) =>
                a.title.localeCompare(
                    b.title
                )
        );

    }


    visible.sort(
        (a,b) =>
            Number(b.pinned) -
            Number(a.pinned)
    );


    taskList.innerHTML = "";


    if (!visible.length) {

        taskList.innerHTML = `

            <div class="empty">

                <div class="empty-icon">
                    ${
                        selectedDate === todayString()
                            ? "🎯"
                            : "📅"
                    }
                </div>

                <h3>
                    No tasks here
                </h3>

                <p>
                    ${
                        selectedDate === todayString()
                            ? "Add something important to your day."
                            : "There are no tasks for this day."
                    }
                </p>

            </div>

        `;

    } else {

        visible.forEach(
            task => {

                taskList.appendChild(
                    createTaskElement(task)
                );

            }
        );

    }


    updateDashboard();

    renderHistory();

}


/* =====================================================
   CREATE TASK HTML
===================================================== */

function createTaskElement(task) {

    const element =
        document.createElement(
            "div"
        );


    element.className =
        "task" +
        (
            task.completed
                ? " completed"
                : ""
        );


    const due =
        task.due
            ? formatDue(task.due)
            : "";


    const overdue =
        isOverdue(task);


    element.innerHTML = `

        <div class="task-top">

            <input
                type="checkbox"
                class="check"
                ${task.completed ? "checked" : ""}
            >

            <div class="task-main">

                <div class="task-title">

                    ${task.pinned ? "📌 " : ""}
                    ${escapeHTML(task.title)}

                </div>


                <div class="task-meta">

                    <span class="badge ${task.priority}">
                        ${priorityIcon(task.priority)}
                        ${capitalize(task.priority)}
                    </span>

                    <span class="badge blue">
                        ${categoryIcon(task.category)}
                        ${escapeHTML(task.category || "Other")}
                    </span>

                    ${
                        task.recurring
                            ? `
                                <span class="badge blue">
                                    🔄 Repeats
                                </span>
                              `
                            : ""
                    }

                    ${
                        due
                            ? `
                                <span class="badge ${
                                    overdue
                                        ? "overdue"
                                        : "blue"
                                }">
                                    ${
                                        overdue
                                            ? "⚠️ "
                                            : "📅 "
                                    }
                                    ${due}
                                </span>
                              `
                            : ""
                    }

                </div>


                ${
                    task.notes
                        ? `
                            <div class="notes">
                                📝 ${escapeHTML(task.notes)}
                            </div>
                          `
                        : ""
                }

            </div>


            <div class="task-actions">

                <button
                    class="task-action pin">
                    ${task.pinned ? "📌" : "📍"}
                </button>

                <button
                    class="task-action edit">
                    ✏️
                </button>

                <button
                    class="task-action delete">
                    🗑️
                </button>

            </div>

        </div>

    `;


    element.querySelector(
        ".check"
    ).onchange =
        () =>
            toggleTask(task.id);


    element.querySelector(
        ".pin"
    ).onclick =
        () =>
            togglePin(task.id);


    element.querySelector(
        ".edit"
    ).onclick =
        () =>
            openEdit(task.id);


    element.querySelector(
        ".delete"
    ).onclick =
        () =>
            deleteTask(task.id);


    return element;

}


/* =====================================================
   DASHBOARD
===================================================== */

function updateDashboard() {

    const dayTasks =
        getDayTasks();


    const completed =
        dayTasks.filter(
            t => t.completed
        ).length;


    const total =
        dayTasks.length;


    const percent =
        total
            ? Math.round(
                completed /
                total *
                100
            )
            : 0;


    document.getElementById(
        "totalToday"
    ).textContent =
        total;


    document.getElementById(
        "completedToday"
    ).textContent =
        completed;


    document.getElementById(
        "progressText"
    ).textContent =
        percent + "%";


    document.getElementById(
        "progressBar"
    ).style.width =
        percent + "%";


    document.getElementById(
        "streak"
    ).textContent =
        settings.streak;


    document.getElementById(
        "focusMinutes"
    ).textContent =
        settings.focusMinutes;


    const goal =
        settings.dailyGoal || 5;


    const goalPercent =
        Math.min(
            100,
            Math.round(
                completed /
                goal *
                100
            )
        );


    document.getElementById(
        "goalText"
    ).textContent =
        `${completed} / ${goal}`;


    document.getElementById(
        "goalBar"
    ).style.width =
        goalPercent + "%";


    document.getElementById(
        "goalInput"
    ).value =
        goal;


    document.getElementById(
        "dateTitle"
    ).textContent =
        formatReadableDate(
            selectedDate
        );

}


/* =====================================================
   STREAK
===================================================== */

function updateStreak() {

    const today =
        todayString();


    if (
        settings.lastCompletedDay ===
        today
    ) {

        return;

    }


    const yesterday =
        addDays(today, -1);


    if (
        settings.lastCompletedDay ===
        yesterday
    ) {

        settings.streak++;

    } else {

        settings.streak = 1;

    }


    settings.lastCompletedDay =
        today;


    save();

}


/* =====================================================
   HISTORY
===================================================== */

function createHistoryForDay(
    dateKey
) {

    const dayTasks =
        tasks.filter(
            task =>
                task.date ===
                    dateKey &&
                !task.template
        );


    if (!dayTasks.length)
        return;


    const completed =
        dayTasks.filter(
            task =>
                task.completed
        ).length;


    history[dateKey] = {

        total:
            dayTasks.length,

        completed,

        percent:
            Math.round(
                completed /
                dayTasks.length *
                100
            )

    };

}


function renderHistory() {

    const historyList =
        document.getElementById(
            "historyList"
        );


    const dates =
        Object.keys(history)
            .sort()
            .reverse()
            .slice(0, 14);


    historyList.innerHTML = "";


    dates.forEach(
        date => {

            const item =
                document.createElement(
                    "div"
                );

            item.className =
                "history-item";


            item.innerHTML = `

                <span class="history-date">
                    ${formatReadableDate(date)}
                </span>

                <span>
                    ${history[date].completed}
                    /
                    ${history[date].total}

                    <span class="history-percent">
                        ${history[date].percent}%
                    </span>
                </span>

            `;


            item.onclick = () => {

                selectedDate = date;

                render();

            };


            historyList.appendChild(
                item
            );

        }
    );

}


/* =====================================================
   DATE NAVIGATION
===================================================== */

document.getElementById(
    "previousDay"
).onclick = function() {

    selectedDate =
        addDays(
            selectedDate,
            -1
        );

    render();

};


document.getElementById(
    "nextDay"
).onclick = function() {

    selectedDate =
        addDays(
            selectedDate,
            1
        );


    if (
        selectedDate ===
        todayString()
    ) {

        prepareDay();

    }


    render();

};


document.getElementById(
    "todayButton"
).onclick = function() {

    selectedDate =
        todayString();

    prepareDay();

    render();

};


/* =====================================================
   SEARCH
===================================================== */

search.oninput =
    render;

filter.onchange =
    render;

sort.onchange =
    render;


/* =====================================================
   GOAL
===================================================== */

document.getElementById(
    "goalInput"
).onchange =
function() {

    let value =
        Number(this.value);


    if (value < 1)
        value = 1;


    if (value > 100)
        value = 100;


    settings.dailyGoal =
        value;


    save();

    render();

};


/* =====================================================
   THEME
===================================================== */

function applyTheme() {

    document.body.classList.toggle(
        "dark",
        settings.dark
    );

}


document.getElementById(
    "themeBtn"
).onclick = function() {

    settings.dark =
        !settings.dark;

    applyTheme();

    save();

};


/* =====================================================
   TIMER
===================================================== */

function updateTimer() {

    const min =
        Math.floor(
            timerSeconds / 60
        );

    const sec =
        timerSeconds % 60;


    document.getElementById(
        "timer"
    ).textContent =
        String(min).padStart(2,"0") +
        ":" +
        String(sec).padStart(2,"0");

}


function startTimer() {

    if (timerRunning) {

        clearInterval(
            timerInterval
        );

        timerRunning = false;

        document.getElementById(
            "startTimer"
        ).textContent =
            "Start";

        return;

    }


    timerRunning = true;


    document.getElementById(
        "startTimer"
    ).textContent =
        "Pause";


    timerInterval =
        setInterval(
            () => {

                timerSeconds--;

                updateTimer();


                if (
                    timerSeconds <= 0
                ) {

                    clearInterval(
                        timerInterval
                    );

                    timerRunning = false;


                    settings.focusMinutes +=
                        25;


                    save();


                    document.getElementById(
                        "startTimer"
                    ).textContent =
                        "Start";


                    showToast(
                        "Focus session complete! 🎉"
                    );


                    notify(
                        "Focus session complete",
                        "Great work. Take a short break."
                    );


                    render();

                }

            },
            1000
        );

}


document.getElementById(
    "startTimer"
).onclick =
    startTimer;


document.getElementById(
    "resetTimer"
).onclick =
function() {

    clearInterval(
        timerInterval
    );

    timerRunning = false;

    timerSeconds =
        25 * 60;

    document.getElementById(
        "startTimer"
    ).textContent =
        "Start";

    updateTimer();

};


document.querySelectorAll(
    ".mode"
).forEach(
    button => {

        button.onclick =
        function() {

            document.querySelectorAll(
                ".mode"
            ).forEach(
                b =>
                    b.classList.remove(
                        "active"
                    )
            );


            this.classList.add(
                "active"
            );


            clearInterval(
                timerInterval
            );

            timerRunning = false;


            timerSeconds =
                Number(
                    this.dataset.min
                ) * 60;


            document.getElementById(
                "startTimer"
            ).textContent =
                "Start";


            updateTimer();

        };

    }
);


/* =====================================================
   NOTIFICATIONS
===================================================== */

document.getElementById(
    "notificationBtn"
).onclick =
async function() {

    if (
        !("Notification" in window)
    ) {

        showToast(
            "Notifications aren't supported here."
        );

        return;

    }


    const permission =
        await Notification
            .requestPermission();


    if (
        permission ===
        "granted"
    ) {

        showToast(
            "Notifications enabled 🔔"
        );

    }

};


function notify(title, body) {

    if (
        "Notification" in window &&
        Notification.permission ===
            "granted"
    ) {

        new Notification(
            title,
            { body }
        );

    }

}


/* =====================================================
   OVERDUE
===================================================== */

function isOverdue(task) {

    return Boolean(
        task.due &&
        !task.completed &&
        new Date(task.due) <
            new Date()
    );

}


function formatDue(value) {

    return new Date(value)
        .toLocaleString(
            undefined,
            {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit"
            }
        );

}


/* =====================================================
   HELPERS
===================================================== */

function priorityIcon(priority) {

    if (
        priority === "high"
    )
        return "🔴";

    if (
        priority === "medium"
    )
        return "🟡";

    return "🟢";

}


function categoryIcon(category) {

    const icons = {

        Study: "📚",
        Coding: "💻",
        Work: "💼",
        LifeFix: "🌐",
        Fitness: "🏃",
        Personal: "👤",
        Other: "📌"

    };

    return icons[category] || "📌";

}


function capitalize(text) {

    return text.charAt(0)
        .toUpperCase() +
        text.slice(1);

}


function escapeHTML(text) {

    const div =
        document.createElement(
            "div"
        );

    div.textContent =
        text;

    return div.innerHTML;

}


/* =====================================================
   GREETING
===================================================== */

function greeting() {

    const hour =
        new Date().getHours();


    if (hour < 12)
        return "Good morning. Start strong. ☀️";

    if (hour < 18)
        return "Good afternoon. Stay focused. 💪";

    return "Good evening. Finish strong. 🌙";

}


document.getElementById(
    "greeting"
).textContent =
    greeting();


/* =====================================================
   TIPS
===================================================== */

const tips = [

    "Put your phone away during a focus session.",

    "Start with the smallest task instead of waiting for motivation.",

    "Work for 25 minutes without checking social media.",

    "Break a large task into smaller tasks.",

    "If something takes less than two minutes, do it now.",

    "Choose your most important task before starting your day.",

    "You don't need to finish everything. Finish what matters.",

    "Use the focus timer and give one task your full attention.",

    "Consistency beats motivation.",

    "When distracted, write down the distraction and return to your task."

];


document.getElementById(
    "tip"
).textContent =
    tips[
        Math.floor(
            Math.random() *
            tips.length
        )
    ];


/* =====================================================
   KEYBOARD SHORTCUTS
===================================================== */

document.addEventListener(
    "keydown",
    event => {

        const tag =
            document.activeElement
                .tagName;


        if (
            event.key === "n" &&
            tag !== "INPUT" &&
            tag !== "TEXTAREA"
        ) {

            taskInput.focus();

        }


        if (
            event.key === "/" &&
            tag !== "INPUT" &&
            tag !== "TEXTAREA"
        ) {

            event.preventDefault();

            search.focus();

        }


        if (
            event.code === "Space" &&
            tag !== "INPUT" &&
            tag !== "TEXTAREA"
        ) {

            event.preventDefault();

            startTimer();

        }

    }
);


/* =====================================================
   AUTOMATIC DAY CHECK
===================================================== */

/*
    If the app stays open overnight,
    this detects the new day automatically.
*/

let lastKnownDate =
    todayString();


setInterval(
    function() {

        const current =
            todayString();


        if (
            current !==
            lastKnownDate
        ) {

            lastKnownDate =
                current;


            selectedDate =
                current;


            prepareDay();

            render();

            showToast(
                "🌅 New day — your plan has been refreshed."
            );

        }

    },
    30000
);


/* =====================================================
   START APP
===================================================== */

applyTheme();

prepareDay();

updateTimer();

render();

