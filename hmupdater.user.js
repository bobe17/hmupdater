/**
 * hmupdater.user.js
 * Copyright (c) 2008 Aurélien Maille
 * Released under the GPL license 
 * 
 * @version 0.2
 * @author  Aurélien Maille <bobe+hordes@webnaute.net>
 * @link    http://dev.webnaute.net/Applications/HMUpdater/
 * @license http://www.gnu.org/copyleft/gpl.html  GNU General Public License
 * @charset UTF-8
 */

// --------------------------------------------------------------------
// 
// This is a Greasemonkey user script.
// 
// To install, you need Greasemonkey: http://www.greasespot.net/
// Then restart Firefox and revisit this script.
// Under Tools, there will be a new menu item to "Install User Script".
// Accept the default configuration and install.
// 
// To uninstall, go to Tools/Manage User Scripts,
// select "HMUpdater", and click Uninstall.
// 
// --------------------------------------------------------------------
// 
// ==UserScript==
// @name           HMUpdater
// @namespace      http://dev.webnaute.net/Applications/HMUpdater
// @description    Mise à jour de HordesM@p à partir de hordes.fr
// @include        http://www.hordes.fr/#outside
// @include        http://www.hordes.fr/#
// @include        http://www.hordes.fr/
// ==/UserScript==
// 
// --------------------------------------------------------------------
// 
// @todo
// - Récupération automatique des coordonnées de la case
// - Pouvoir configurer de façon user-friendly le login et l'URL de l'application réceptrice
// - Pouvoir configurer une URL pour chaque login
// - Compatibilité avec Opera et Safari ? (plus lointain et incertain)
// - Ajouter une entrée dans la partie "chat" indiquant la mise à jour de hordesm@p
//   (pour voir facilement si objet pris/déposé après la mise à jour) ? Compliqué
// - Vérifier si le bricolage pour gérer le timeout est correct ou si on peut faire autrement
// - Lien parfois non ajouté à la sortie de la ville; obligé d'actualiser la page. Investiguer
//

const HMU_VERSION  = '0.2';
const HMU_APPNAME  = 'HMUpdater';
const HMU_TIMEOUT  = 10;// en secondes
const HMU_APPHOME  = 'http://dev.webnaute.net/Applications/HMUpdater/';
const POSTDATA_URL = '';


function HMU_setLogin()
{
	var login;
	if( (login = prompt("Saisissez votre pseudo de joueur à hordes :", GM_getValue('login', ''))) != null ) {
		GM_setValue('login', login);
	}
	
	return login == null ? '' : login;
}

function HMU_setPostdataURL()
{
	var postdata_url;
	if( (postdata_url = prompt("Saisissez l’URL de l’application externe :", GM_getValue('postdata_url', ''))) != null ) {
		// hack patam@p
		if( /^http:\/\/patastream\.com\//.test(postdata_url) ) {
			postdata_url = postdata_url.replace('view_ville', 'xmlpost');
		}
		// end hack
		GM_setValue('postdata_url', postdata_url);
	}
	
	return postdata_url == null ? '' : postdata_url;
}

GM_registerMenuCommand('Configurer ' + HMU_APPNAME, function() {
	HMU_setLogin();
	HMU_setPostdataURL();
});

if( GM_getValue('postdata_url', '') == '' ) {
	GM_setValue('postdata_url', POSTDATA_URL);
}

var loadingSection = {
	show: function() {
		document.getElementById('loading_section').style.display = 'block';
		document.body.style.cursor = 'progress';
	},
	hide: function() {
		document.getElementById('loading_section').style.display = 'none';
		document.body.style.cursor = 'default';
	}
};

var resultMessage  = {
	timer: null,
	box: null,
	// function(message, autoHide = true)
	show: function(message) {
		resultMessage.box.innerHTML = "<strong>HMUpdater</strong>\u00A0: " + message;
		resultMessage.box.style.setProperty('opacity', '1.0', '');
		resultMessage.box.style.display = 'block';
		
		if( arguments.length == 1 || arguments[1] == true ) {
			setTimeout(function() {resultMessage.hide();}, 4000);
		}
	},
	hide: function() {
		resultMessage.timer = setInterval(function() {resultMessage.reduceOpacity();}, 60);
	},
	reduceOpacity: function() {
		var tmp = parseFloat(resultMessage.box.style.getPropertyValue('opacity'));
		tmp = (Math.round((tmp - 0.1) * 10) / 10);
		
		resultMessage.box.style.setProperty('opacity', tmp, '');
		
		if( tmp <= 0 ) {
			resultMessage.box.style.display = 'none';
			clearInterval(resultMessage.timer);
		}
	}
};

//
// Insertion du bloc message
//
resultMessage.box = document.createElement('div');
resultMessage.box.setAttribute('id', 'hmu-message');
document.body.insertBefore(resultMessage.box, document.body.firstChild);

resultMessage.box.style.cssText = 'display:none; min-width:300px; max-width:550px; position:fixed;' +
	'right: 5px; bottom: 5px; z-index:10; padding:5px 10px; color:#f0d79e;' +
	'background-color:#5c2b20; border:1px solid #b37c4a; outline:2px solid black;';

// voir bloc 'TEMPORAIRE' un peu plus bas
var eraseCoords = true;

//
// lancement du refresh
//
var timer = setInterval(function() {

//
// Page de connexion au jeu ?
//
if( document.getElementById('hordes_login') != null ) {
	document.getElementById('hordes_login').addEventListener('submit', function(evt) {
		var login = document.getElementById('login').value;
		// hack patam@p pour éviter confusion de villes entre plusieurs comptes
		if( /^http:\/\/patastream\.com\//.test(GM_getValue('postdata_url', '')) && login != GM_getValue('login', '') ) {
			GM_setValue('postdata_url', POSTDATA_URL);
		}
		// end hack
		GM_setValue('login', login);
	}, false);
	clearInterval(timer);
	return false;
}

if( document.getElementById('hmupdater') != null || document.getElementById('generic_section') == null ) {
	return false;
}

//
// Récupération de la clef API
//
var key = null;

if( document.getElementById('sites') != null ) {
	var listing = document.getElementById('sites').getElementsByTagName('a');
	
	for( var i = 0, m = listing.length; i < m; i++ ) {
		if( /(?:\?|&)key=([a-zA-Z0-9]+)/.test(listing[i].href) ) {
			key = RegExp.$1;
			break;
		}
	}
	
	if( key == null ) {// Applications externes non autorisées; pas de clef API
		return false;
	}
}

var GENERIC_SECTION_NODE = document.getElementById('generic_section');

var refresh_link = document.evaluate('a[@href="#outside/refresh"]',
	GENERIC_SECTION_NODE, null, XPathResult.ANY_TYPE, null);
if( (refresh_link = refresh_link.iterateNext()) == null ) {
	return false;
}

//////////////////////////
// TEMPORAIRE
// 
// But de la fonction:
// Le problème est que je ne peux pas détecter (actuellement) un
// changement de case, ni obtenir les coordonnées de la case par moi-même.
// Je dois donc demander systématiquement les coordonnées au joueur.
// La fonction suivante détecte si l'utilisateur fait certaines actions
// qui ont rafraichi la page sans que ce soit un changement de case
// (liens actualiser, fouiller, explorer, déblayer, envoyer un message dans le chat, etc).
// Dans ces cas-là, on réutilise les coordonnées gardées en mémoire, ce sera
// toujours ça...
if( GENERIC_SECTION_NODE.hasAttribute('hmupdater:init') == false ) {
/*	GM_log('listeners added to GENERIC_SECTION_NODE');
	GENERIC_SECTION_NODE.addEventListener('DOMNodeRemoved', function(evt){
		if( evt.target.nodeType == 1 ) {// TODO : Node existe mais Node.ELEMENT_NODE est undefined, comprends pas...
			GM_log('node removed : tag ' + evt.target.nodeName + ', id ' + evt.target.id);
		}
	}, false);*/
	
	GENERIC_SECTION_NODE.addEventListener('click', function(evt) {
		var node = evt.target;
		
		if( evt.eventPhase != evt.CAPTURING_PHASE ) {
			return false;
		}
		
		// liens "actualiser"
		if( node.nodeName == 'A' && node.getAttribute('href') == '#outside/refresh' ) {
			eraseCoords = false;
		}
		// déplacement d'objets entre le sac et le sol et vice versa
		else if( node.nodeName == 'IMG' && node.getAttribute('alt') == 'item' && node.parentNode.nodeName == 'A' ) {
			eraseCoords = false;
		}
		// envoi de message sur le "chat"
		// - firefox prend aussi le click si on sélectionne le "bouton" avec la touche tab + entrée
		//   ou si on tape entrée dans le champ texte à la fin de son message.
		//   Tant mieux, ça me facilite les choses.
		else if( node.nodeName == 'INPUT' && node.getAttribute('name') == 'submit' ) {
			eraseCoords = false;
		}
		// plus compliqué pour les liens de la colonne 'left' car le target peut avoir
		// plusieurs valeurs, on va s'y prendre autrement et remonter l'arborescence
		else {
			while( node.nodeName != 'A' && node != evt.currentTarget ) {
				node = node.parentNode;
			}
			
			if( node.nodeName == 'A' ) {
				var target = node.getAttribute('href');
				
				if( target.substr(0, 8) == '#outside' ) {
					switch( target ) {
						case '#outside/pick':// fouille
						case '#outside/dig':// exploration de bâtiment
						case '#outside/extractBuilding':// déblaiement de ruines
							eraseCoords = false;
							break;
					}
				}
				else if( /#tool\/[0-9]+\/use/.test(target) ) {// Utilisation d'un objet
					eraseCoords = false;
				}
			}
		}
	}, true);
	
	// On s'occupe aussi de la liste déroulante de changement de statut de la zone
	GENERIC_SECTION_NODE.addEventListener('change', function(evt) {
		if( evt.target.getAttribute('name') == 'tid' ) {
			eraseCoords = false;
		}
	}, true);
	
	GENERIC_SECTION_NODE.setAttribute('hmupdater:init', 'true');
}
//////////////////////////

if( eraseCoords ) {
	GM_setValue('coords', '');
}
else {
	eraseCoords = true;
}

// Utilisé pour éviter de renvoyer le XML si rien n'a changé sur la case
GM_setValue('zone_updated', false);

//
// Ajout du lien de mise à jour
//
var cssText = 'float:right;margin-left:15px;font-size:8pt;';
refresh_link.removeAttribute('class');
refresh_link.style.cssText = cssText;

var link = document.createElement('a');
link.setAttribute('id',    'hmupdater');
link.setAttribute('href',  '#outside/hmupdater');
link.style.cssText = cssText;

link.appendChild(document.createTextNode('Mettre à jour la M@p'));

refresh_link.parentNode.insertBefore(link, refresh_link.nextSibling);
refresh_link.parentNode.insertBefore(document.createTextNode(' '), refresh_link);

//////////////////////////////////////////////
link.addEventListener('click', function(evt) {
	
	evt.preventDefault();
	evt.stopPropagation();
	
	//
	// Récupération du pseudo
	//
	var login = GM_getValue('login', '') || HMU_setLogin();
	if( login == '' ) {
		return false;
	}
	
	//
	// Récupération de l'URL à appeler
	//
	var postdata_url = GM_getValue('postdata_url', '') || HMU_setPostdataURL();
	if( postdata_url == '' ) {
		return false;
	}
	
	//
	// Récupération des coordonnées de la case
	//
	var coords = GM_getValue('coords', '');
	if( coords == '' ) {
		if( (coords = prompt("Saisissez les coordonnées de la case (format\u00A0: x.y)")) != null ) {
			if( /^[0-9]{1,2}\.[0-9]{1,2}$/.test(coords) ) {
				GM_setValue('coords', coords);
			}
			else {
				return false;
			}
		}
		else {
			return false;
		}
	}
	
	//
	// Récupération des données
	//
	
	// Un bâtiment dans la zone ?
	var buildingName = '';
	var ruine = document.evaluate('count(div[@class="outSpot"]//img[@alt="x"])',
		GENERIC_SECTION_NODE, null, XPathResult.NUMBER_TYPE, null).numberValue;
	
	if( ruine == 0 ) {
		buildingName = document.evaluate('div[@class="outSpot"]/h2',
			GENERIC_SECTION_NODE, null, XPathResult.STRING_TYPE, null).stringValue;
	}
	
	// Récupération du statut de la case
	var caseTag = -1;
	var selectBox = document.evaluate('div[@class="right"]//select[@name="tid"]',
		GENERIC_SECTION_NODE, null, XPathResult.ANY_TYPE, null);
	if( (selectBox = selectBox.iterateNext()) != null ) {
		caseTag = parseInt(selectBox.value);
	}
	
	// Récupération du nombre de zombies
	var zombiePts = -1;
	if( document.getElementById('zombiePts') != null ) {
		zombiePts = document.getElementById('zombiePts').firstChild.data;
		/([0-9]+)\spoints?/.test(zombiePts);
		zombiePts = RegExp.$1;
	}
	
	// Listing des objets présents par terre
	var items = document.evaluate('div[@class="right"]/ul[@class="tools shortTools outInv"]//img[@alt="item"]',
		GENERIC_SECTION_NODE, null, XPathResult.ANY_TYPE, null);
	var item = null, name = null, broken = null;
	var itemsArray = [];
	
	while( (item = items.iterateNext()) != null ) {
		name = item.getAttribute('src');
		name = name.substring(name.indexOf('_')+1, name.lastIndexOf('.'));
		broken = (item.parentNode.className == 'limited') ? true : false;
		
		if( typeof(itemsArray[name]) == 'undefined' ) {
			itemsArray[name] = [];
			itemsArray[name]['broken'] = 0;
			itemsArray[name]['notbroken'] = 0;
		}
		
		if( broken ) {
			itemsArray[name]['broken']++;
		}
		else {
			itemsArray[name]['notbroken']++;
		}
	}
	
	//
	// Génération du document XML
	//
	
	var doc = document.implementation.createDocument("", "hordes", null);
	var pi  = doc.createProcessingInstruction('xml', 'version="1.0" encoding="UTF-8"');
	doc.insertBefore(pi, doc.documentElement);
	
	var headers = doc.createElement('headers');
	headers.setAttribute('version',   HMU_VERSION);
	headers.setAttribute('generator', HMU_APPNAME);
	doc.documentElement.appendChild(headers);
	
	var citizen = doc.createElement('citizen');
	citizen.setAttribute('key', key);
	citizen.setAttribute('login', login);
	doc.documentElement.appendChild(citizen);
	
	var zone = doc.createElement('zone');
	
	// tas de sable éventuels
	if( ruine > 0 ) {
		zone.setAttribute('name', 'unknown');
		zone.setAttribute('ruine', ruine);
	}
	// Bâtiment éventuel
	else if( buildingName != '' ) {
		zone.setAttribute('name', buildingName);
	}
	
	coords = coords.split('.');
	zone.setAttribute('x', coords[0]);
	zone.setAttribute('y', coords[1]);
	zone.setAttribute('tag', caseTag);
	zone.setAttribute('zombie', zombiePts);
	doc.documentElement.appendChild(zone);
	
	items = doc.createElement('items');
	doc.documentElement.appendChild(items);
	
	item = doc.createElement('item');
	item.setAttribute('name',   '');
	item.setAttribute('count',  '');
	item.setAttribute('broken', '');
	
	for( name in itemsArray ) {
		item = item.cloneNode(false);
		item.setAttribute('name',  name);
		
		if( itemsArray[name]['broken'] > 0 ) {
			item.setAttribute('count', itemsArray[name]['broken']);
			item.setAttribute('broken', '1');
		}
		else {
			item.setAttribute('count', itemsArray[name]['notbroken']);
			item.removeAttribute('broken');
		}
		
		items.appendChild(item);
	}
	
	loadingSection.show();
	
	var xhr = {
		timer: null,
		method: 'POST',
		url: postdata_url,
		data: doc,
		headers: {
			'X-Handler'    : HMU_APPNAME,
			'User-Agent'   : HMU_APPNAME + '/' + HMU_VERSION,
			'Content-Type' : 'application/xml; charset="UTF-8"'
		},
		onerror: function() {
			xhr.onload = function(){};
			loadingSection.hide();
			resultMessage.show("Le site cible ne répond pas\u00A0!");
		},
		onload: function(responseDetails) {
			clearTimeout(xhr.timer);
			
			if( responseDetails.status == 200 ) {
				var parser = new DOMParser();
				var code   = null;
				
				try {
					var doc = parser.parseFromString(responseDetails.responseText, 'application/xml');
					code = doc.getElementsByTagName('error')[0].getAttribute('code');
					
					if( Number(doc.getElementsByTagName('headers')[0].getAttribute('version')) > HMU_VERSION ) {
						resultMessage.show("Une nouvelle version du script est disponible en " +
							"<a href='" + HMU_APPHOME + "'>téléchargement</a>.<br>" +
							"Votre version peut ne plus fonctionner correctement, " +
							"vous devriez faire la mise à jour.", false);
					}
					else if( code == 'ok' ) {
						resultMessage.show("La M@p a été mise à jour en " + coords.join('.') + "\u00A0!");
						GM_setValue('zone_updated', true);
					}
				}
				catch(e) {
					code = null;
				}
				
				if( code != 'ok' ) {
					resultMessage.show("Erreur XML renvoyée par le serveur" +
						(code != null ? '\u00A0: ' + code : ''));
				}
			}
			else {
				resultMessage.show("Erreur HTTP renvoyée par le serveur\u00A0: " +
					responseDetails.status + ' ' + responseDetails.statusText);
			}
			
			loadingSection.hide();
		}
	};
	
	if( GM_getValue('zone_updated', false) == false ) {
		GM_xmlhttpRequest(xhr);
		xhr.timer = setTimeout(xhr.onerror, (HMU_TIMEOUT * 1000));
	}
	else {// Aucun changement dans la zone, pas de refresh de la page, inutile de renvoyer les données
		resultMessage.show("La M@p a été mise à jour en " + coords.join('.') + "\u00A0!");
		loadingSection.hide();
	}
}, false);// fin du addEventListener('click'....) sur link

}, 800);// fin du setInterval()

