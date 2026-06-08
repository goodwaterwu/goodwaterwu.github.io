// Simple UUID generator
function uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

let fileHandle;
let appData = { title: "SyncRobotic cheat sheet", items: [] };

const sidebar = document.getElementById('sidebar');
const content = document.getElementById('content');
const modal = document.getElementById('modal');
const modalBody = document.getElementById('modal-body');

async function saveData() {
    if (!fileHandle) return;
    const writable = await fileHandle.createWritable();
    await writable.write(JSON.stringify(appData, null, 2));
    await writable.close();
}

function render() {
    sidebar.innerHTML = '';
    content.innerHTML = '';
    document.querySelector('h1').textContent = appData.title;
    
    appData.items.forEach((item, index) => {
        // Main title link - use unique ID
        const mainLink = document.createElement('a');
        mainLink.href = `#section-${item.id}`;
        mainLink.textContent = item.title;
        mainLink.style.fontWeight = 'bold';
        mainLink.style.display = 'block';
        mainLink.style.marginBottom = '10px';
        sidebar.appendChild(mainLink);

        // Section container - use unique ID
        const section = document.createElement('section');
        section.id = `section-${item.id}`;
        
        // 1. Render Markdown to HTML using marked.js
        const htmlContent = marked.parse(item.content);
        
        // 2. Parse HTML using temporary container
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = htmlContent;
        
        // 3. Extract Headings for Sidebar (h1-h5)
        const headings = tempDiv.querySelectorAll('h1, h2, h3, h4, h5');
        headings.forEach(h => {
            const text = h.textContent;
            const id = text.replace(/\s+/g, '_') + '-' + item.id;
            h.id = id;
            
            const level = parseInt(h.tagName.substring(1));
            // Ensure padding is non-negative and starts from 0px for H1
            const padding = Math.max(0, (level - 1) * 10) + 'px';
            sidebar.appendChild(createSubLink(text, id, padding));
        });

        section.innerHTML = `<h1>${item.title}</h1><div>${tempDiv.innerHTML}</div>`;
        content.appendChild(section);
    });
}

function createSubLink(text, id, padding) {
    const link = document.createElement('a');
    link.href = `#${id}`;
    link.textContent = '└ ' + text;
    link.style.paddingLeft = padding;
    link.style.fontSize = '0.9em';
    link.style.color = '#aaa';
    link.style.display = 'block';
    return link;
}

function getSelectOptions() {
    return appData.items.map(item => `<option value="${item.id}">${item.title}</option>`).join('');
}

document.getElementById('loadFileBtn').onclick = async () => {
    try {
        [fileHandle] = await window.showOpenFilePicker({
            types: [{ description: 'JSON File', accept: {'application/json': ['.json']} }]
        });
        const file = await fileHandle.getFile();
        const content = await file.text();
        appData = JSON.parse(content);
        
        // Ensure all items have an ID (Migration for old data)
        appData.items.forEach(item => {
            if (!item.id) item.id = uuidv4();
        });
        render();
    } catch (err) {
        console.error('Error loading file:', err);
    }
};

document.getElementById('addBtn').onclick = () => {
    if (!fileHandle) return alert('Please load a file first');
    modal.style.display = 'block';
    modalBody.innerHTML = `
        <label style="display:block">Title</label>
        <input id="newTitle" placeholder="Title" style="width:100%">
        <label style="display:block; margin-top:10px">Content</label>
        <textarea id="newContent" placeholder="Content" style="width:100%; height:400px"></textarea>
        <button id="saveBtn" style="margin-top:10px">Save</button>
    `;
    document.getElementById('saveBtn').onclick = async () => {
        appData.items.push({
            id: uuidv4(),
            title: document.getElementById('newTitle').value, 
            content: document.getElementById('newContent').value
        });
        await saveData();
        render();
        modal.style.display = 'none';
    };
};

document.getElementById('modifyBtn').onclick = () => {
    if (!fileHandle) return alert('Please load a file first');
    if (appData.items.length === 0) return alert('No data to modify');
    modal.style.display = 'block';
    modalBody.innerHTML = `
        <label style="display:block">Select Item</label>
        <select id="modSelect" style="width:100%">${getSelectOptions()}</select>
        <label style="display:block; margin-top:10px">Title</label>
        <input id="modTitle" style="width:100%">
        <label style="display:block; margin-top:10px">Content</label>
        <textarea id="modContent" style="width:100%; height:400px"></textarea>
        <button id="updateBtn" style="margin-top:10px">Update</button>
    `;
    const modSelect = document.getElementById('modSelect');
    const updateFields = () => {
        const item = appData.items.find(d => d.id === modSelect.value);
        document.getElementById('modTitle').value = item.title;
        document.getElementById('modContent').value = item.content;
    };
    modSelect.onchange = updateFields;
    updateFields();
    document.getElementById('updateBtn').onclick = async () => {
        // Find the index of the item based on the *current* value of the select menu
        const indexToUpdate = appData.items.findIndex(d => d.id === modSelect.value);
        if (indexToUpdate !== -1) {
            appData.items[indexToUpdate].title = document.getElementById('modTitle').value;
            appData.items[indexToUpdate].content = document.getElementById('modContent').value;
            await saveData();
            render();
            modal.style.display = 'none';
        }
    };
};

document.getElementById('deleteBtn').onclick = () => {
    if (!fileHandle) return alert('Please load a file first');
    if (appData.items.length === 0) return alert('No data to delete');
    modal.style.display = 'block';
    modalBody.innerHTML = `
        <label style="display:block">Select Item to Delete</label>
        <select id="delSelect" style="width:100%">${getSelectOptions()}</select>
        <button id="confirmDelBtn" style="background:red; margin-top:10px">Confirm Delete</button>
    `;
    document.getElementById('confirmDelBtn').onclick = async () => {
        if(confirm('Are you sure?')) {
            appData.items = appData.items.filter(d => d.id !== document.getElementById('delSelect').value);
            await saveData();
            render();
            modal.style.display = 'none';
        }
    };
};

document.querySelector('.close').onclick = () => modal.style.display = 'none';
