const electron = require('electron');
var Datastore = require('nedb')
const url = require('url');
const path = require('path');

const {app, BrowserWindow, Menu, ipcMain} = electron;

//Set Env
process.env.NODE_ENV = 'production';

var barrels = [];
var lastSearch = {};
var exactMatchSearch = false;

let mainWindow;
let addWindow;
let infoWindow;
let searchWindow;
let errorWindow;

//Listen for the app to be ready
app.on('ready', function(){

	//Create new window
	mainWindow = new BrowserWindow({
		webPreferences: {
			nodeIntegration: true
		},
		icon: path.join(__dirname, 'assets/icons/png/64x64.png'),
		titleBarStyle: 'hidden'
	});

	//Load HTML file
	mainWindow.loadURL(url.format({
		pathname: path.join(__dirname, 'mainWindow.html'),
		protocol: 'file:',
		slashes: true
	}));

	//Quit app when closed
	mainWindow.on('closed', function(){
		app.quit();
	});

	//Build menu from template
	const mainMenu = Menu.buildFromTemplate(mainMenuTemplate);
	//Insert menu
	Menu.setApplicationMenu(mainMenu);

	var userData = app.getPath('userData');
	db = new Datastore({ filename: userData+'/db/barrels.db', autoload: true, onload: function(error) {
  		//Load data here
  		db.find({ }, function(err, docs) {
	  		barrels = docs
  		});
  	} });

  	//When mainWindow is ready
	mainWindow.webContents.on('dom-ready', () => {
		if(barrels.length >= 1) {
			for(i = 0; i < barrels.length; i++) {
				mainWindow.webContents.send('barrel:add', barrels[i]);
			}
		}
	});

});

//Handle create add window
function createAddWindow() {
	//Clear old window
	if(addWindow != null) addWindow.close();

	//Create new window
	addWindow = new BrowserWindow({
		webPreferences: {
			nodeIntegration: true
		},
		width: 800,
		height: 600,
		title: 'New Barrel'
	});

	//Load HTML file
	addWindow.loadURL(url.format({
		pathname: path.join(__dirname, 'addWindow.html'),
		protocol: 'file:',
		slashes: true
	}));

	//Garbage collection handle
	addWindow.on('closed', function(){
		addWindow = null;
	});
}

//Handle create search window
function createSearchWindow() {
	//Clear old window
	if(searchWindow != null) searchWindow.close();

	//Create new window
	searchWindow = new BrowserWindow({
		webPreferences: {
			nodeIntegration: true
		},
		width: 800,
		height: 600,
		title: 'Search Barrels'
	});

	//Load HTML file
	searchWindow.loadURL(url.format({
		pathname: path.join(__dirname, 'searchWindow.html'),
		protocol: 'file:',
		slashes: true
	}));

	//Garbage collection handle
	searchWindow.on('closed', function(){
		searchWindow = null;
	});
}

function generateErrorWindow(msg) {
	//Create new window
	errorWindow = new BrowserWindow({
		webPreferences: {
			nodeIntegration: true
		},
		width: 400,
		height: 200,
		title: 'Error'
	});

	//Load HTML file
	errorWindow.loadURL(url.format({
		pathname: path.join(__dirname, 'errorWindow.html'),
		protocol: 'file:',
		slashes: true
	}));

	//Garbage collection handle
	errorWindow.on('closed', function(){
		searchWindow = null;
	});

	//Send message
	errorWindow.webContents.on('dom-ready', () => {
	  	errorWindow.webContents.send('error:message', msg)
	});
}

function generateInfoWindow(id) {
	//Barrel variable
	var barrel = null;

	//Create new window
	infoWindow = new BrowserWindow({
		webPreferences: {
			nodeIntegration: true
		},
		width: 800,
		height: 600,
		title: 'Barrel Info'
	});

	//Load HTML file
	infoWindow.loadURL(url.format({
		pathname: path.join(__dirname, 'infoWindow.html'),
		protocol: 'file:',
		slashes: true
	}));

	//Close window
	ipcMain.on('info:close', function(e) {
		try {
			infoWindow.close()
		}
		catch(err) {

		}
	});

	//Garbage collection handle
	infoWindow.on('closed', function(){
		infoWindow = null;
	});

	infoWindow.webContents.on('dom-ready', () => {
		db.findOne({ _id: id }, function(err, doc) {
	  		infoWindow.webContents.send('barrel:info', doc)
  		});
	});
}

//Refresh barrel list
function reloadBarrels() {
	//Clear current list
	mainWindow.webContents.send('barrel:clear');

	//Fetch new list
	db.find({ }, function(err, docs) {
		barrels = docs
		if(barrels.length >= 1) {
			for(i = 0; i < barrels.length; i++) {
				mainWindow.webContents.send('barrel:add', barrels[i]);
			}
		}
  	});
}

//Search for specific information in the barrels
function searchBarrels(search, exactMatch) {
	//Saving search settings
	lastSearch = search;
	exactMatchSearch = exactMatch;

	//Clearing current list
	mainWindow.webContents.send('barrel:clear');

	//If searching for an exact match
	if(exactMatch) {
		//Remove empty parameters
		Object.keys(search).forEach(function(key,index) {
			if(search[key] === '[\\s\\S]*') delete search[key]; 
		});

		//Search for the barrels matching the remaining parameters
		db.find(search, function(err, docs) {
			barrels = docs
			if(barrels.length >= 1) {
				for(i = 0; i < barrels.length; i++) {
					//Add matched barrel to the list
					mainWindow.webContents.send('barrel:add', barrels[i]);
				}
			}
		});
	//If not searching for an exact match
	} else {
		//Formatting search parameters
		Object.keys(search).forEach(function(key,index) {
			if(search[key] != '[\\s\\S]*') search[key] = search[key].replace(/ /g, '').split('').join('\\s*');
		});

		//Search for barrels matching given parameters
		db.find({ _id: { $regex: new RegExp(search._id, 'i')},
			contents: { $regex: new RegExp(search.contents, 'i')},
			year: { $regex: new RegExp(search.year, 'i')},
			cooper: { $regex: new RegExp(search.cooper, 'i')},
			toast: { $regex: new RegExp(search.toast, 'i')},
			region: { $regex: new RegExp(search.region, 'i')},
			size: { $regex: new RegExp(search.size, 'i')},
			comments: { $regex: new RegExp(search.comments, 'i')}
		}, function (err, docs) {
			barrels = docs
			if(barrels.length >= 1) {
				for(i=0; i < barrels.length; i++) {
					//Add matched barrel to the list
					mainWindow.webContents.send('barrel:add', barrels[i]);
				}
			}
		});
	}
}

//Catch barrel:add
ipcMain.on('barrel:add', function(e, barrel) {
	db.count({ _id: barrel._id }, function(err, count) {
		//Check for barrels with a matching _id value
		if(count >= 1) {
			generateErrorWindow('This ID is already in use.')
		//Prevent ids starting with 0, as the CSV file will trim any integer id starting with 0
		} else if(barrel._id[0] === "0") {
			generateErrorWindow('ID cannot start with a 0.')
		//Otherwise, add the barrel to the database and the list
		} else {
			mainWindow.webContents.send('barrel:add', barrel);
			db.insert(barrel)
		}
		//Close the addWindow
		addWindow.close()
	})
});

//Catch barrel:remove
ipcMain.on('barrel:remove', function(e, id) {
	//Remove the barrel with the given id from the database
	db.remove({ _id: id }, {}, function(err, numRemoved) {

	});
});

//Catch barrel:info
ipcMain.on('barrel:info', function(e, id) {
	//Generate the info for the given id
	generateInfoWindow(id);
});

//Catch barrel:update
ipcMain.on('barrel:update', function(e, barrel) {
	//Update the given barrel's information in the database
	db.update({ _id: barrel._id }, barrel, { upsert: true }, function(err, numReplaced) {

	});
});

//Catch barrel:reload
ipcMain.on('barrel:reload', function(e) {
	//Reload the barrel list
	reloadBarrels();
});

//Catch barrel:search
ipcMain.on('barrel:search', function(e, search, exactMatch) {
	//Search the database for barrels matching the given values
	searchBarrels(search, exactMatch);

	//Close the search window
  	searchWindow.close();
})

//Catch error:close
ipcMain.on('error:close', function(e) {
	//Close the error window
	errorWindow.close();
});

//Catch open:add
ipcMain.on('open:add', function(e) {
	//Open the addWindow
	createAddWindow();
});

//Catch open:search
ipcMain.on('open:search', function(e) {
	//Open searchWindow
	createSearchWindow();
});

//Catch clear:search
ipcMain.on('clear:search', function(e) {
	//Reset search values, refill the list
	searchBarrels({}, true);
});

//Catch download:CSV
ipcMain.on('download:CSV', function(e) {

	var results;

	//If the last search was an exact match search
	if(exactMatchSearch) {
		Object.keys(lastSearch).forEach(function(key,index) {
			if(lastSearch[key] === '[\\s\\S]*') delete lastSearch[key]; 
		});
		db.find(lastSearch, function(err, docs) {
			results = docs;
		});
	} else {
		Object.keys(lastSearch).forEach(function(key,index) {
			if(lastSearch[key] != '[\\s\\S]*') lastSearch[key] = lastSearch[key].replace(/ /g, '').split('').join('\\s*');
		});
		db.find({ _id: { $regex: new RegExp(lastSearch._id, 'i')},
			contents: { $regex: new RegExp(lastSearch.contents, 'i')},
			year: { $regex: new RegExp(lastSearch.year, 'i')},
			cooper: { $regex: new RegExp(lastSearch.cooper, 'i')},
			toast: { $regex: new RegExp(lastSearch.toast, 'i')},
			region: { $regex: new RegExp(lastSearch.region, 'i')}
		}, function (err, docs) {
			results = docs;
		});
	}
	db.find(lastSearch, function(err, docs) {
		mainWindow.webContents.send('download:CSV', { inputData: results });
	});
});

//Catch download:CSV
ipcMain.on('close:info', function(e) {
	infoWindow.close();
});

//Catch download:CSV
ipcMain.on('close:add', function(e) {
	addWindow.close();
});

//Catch download:CSV
ipcMain.on('close:search', function(e) {
	searchWindow.close();
});

//Create menu template
const mainMenuTemplate = [
	{
		label: 'File',
		submenu: [
			{
				label: 'Add Barrel',
				click() {
					createAddWindow();
				}
			},
			{
				label: 'Search',
				click() {
					createSearchWindow();
				}
			},
			{
				label: 'Clear Search',
				click() {
					searchBarrels({});
				}
			},
			{
				label: 'Download CSV',
				click() {
					db.find(lastSearch, function(err, docs) {
						mainWindow.webContents.send('download:CSV', { inputData: docs });
					});
				}
			},
			{
				label: 'Quit',
				accelerator: process.platform == 'darwin' ? 'Command+Q' : 'Ctrl+Q',
				click() {
					app.quit();
				}
			}
		]
	}
];

//If mac, add empty object to menu
if (process.platform == 'darwin') {
  var name = app.getName();
  mainMenuTemplate.unshift({
    label: name,
    submenu: [
      {
        label: 'About ' + name,
        role: 'about'
      },
      {
        type: 'separator'
      },
      {
        label: 'Services',
        role: 'services',
        submenu: []
      },
      {
        type: 'separator'
      },
      {
        label: 'Hide ' + name,
        accelerator: 'Command+H',
        role: 'hide'
      },
      {
        label: 'Hide Others',
        accelerator: 'Command+Alt+H',
        role: 'hideothers'
      },
      {
        label: 'Show All',
        role: 'unhide'
      },
      {
        type: 'separator'
      },
      {
        label: 'Quit',
        accelerator: 'Command+Q',
        click() { app.quit(); }
      },
    ]
  });
}

//Add dev tools item if not in production
if(process.env.NODE_ENV !== 'production') {
	mainMenuTemplate.push({
		label: 'Developer Tools',
		submenu: [
			{
				label: 'Toggle Dev Tools',
				accelerator: process.platform == 'darwin' ? 'Command+I' : 'Ctrl+I',
				click(item, focusedWindow) {
					focusedWindow.toggleDevTools();
				}
			},
			{
				role: 'reload'
			}
		]
	});
}