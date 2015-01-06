var moment = require('moment');

var untranslated = {
  human: 'Human',
  computer: 'Computer',
  notConnected: 'Not connected',
  connectionError: 'Connection error',
  noInternetConnection: 'No internet connection',
  unauthorizedError: 'Access is unauthorized',
  lichessIsNotReachableError: 'lichess.org is unreachable',
  resourceNotFoundError: 'Resource not found',
  lichessIsUnavailableError: 'lichess.org is temporarily down for maintenance',
  serverError: 'The server encountered an error',
  color: 'Color',
  clock: 'Clock',
  disableSleepDuringGame: 'Disable sleep during game',
  sound: 'Sound',
  showCoordinates: 'Show board coordinates',
  animations: 'Pieces animations'
};

var defaultCode = 'en';

function loadMomentLocale(code, callback) {
  moment.locale(code);
  callback();
}

function loadLocale(code, callback) {
  var i18nLoc = window.cordova ? (window.device.platform === 'Android' ?
    '/android_asset/www/i18n' : 'i18n') : 'i18n';
  m.request({
    url: i18nLoc + '/' + code + '.json',
    method: 'GET'
  }).then(function(data) {
    messages = data;
    loadMomentLocale(code, callback);
  }, function(error) {
    // workaround for iOS: because xhr for local file has a 0 status it will
    // reject the promise, but still have the response object
    if (error && error.playWithAFriend) {
      messages = error;
      callback();
    } else {
      if (code === defaultCode) throw new Error(error);
      console.log(error, 'defaulting to ' + defaultCode);
      loadLocale(defaultCode, callback);
    }
  });
}

function loadPreferredLanguage(callback) {
  window.navigator.globalization.getPreferredLanguage(
    function(language) {
      loadLocale(language.value.split('-')[0], callback);
    },
    function() {
      loadLocale(defaultCode, callback);
    });
}

module.exports = function(key) {
  var str = messages[key] || untranslated[key] || key;
  Array.prototype.slice.call(arguments, 1).forEach(function(arg) {
    str = str.replace('%s', arg);
  });
  return str;
};
module.exports.loadPreferredLanguage = loadPreferredLanguage;
