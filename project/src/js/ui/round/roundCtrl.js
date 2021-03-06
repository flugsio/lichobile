import throttle from 'lodash/throttle';
import makeData from './data';
import * as utils from '../../utils';
import sound from '../../sound';
import vibrate from '../../vibrate';
import gameApi from '../../lichess/game';
import ground from './ground';
import promotion from './promotion';
import chat from './chat';
import notes from './notes';
import clockCtrl from './clock/clockCtrl';
import i18n from '../../i18n';
import gameStatus from '../../lichess/status';
import correspondenceClockCtrl from './correspondenceClock/corresClockCtrl';
import session from '../../session';
import socket from '../../socket';
import signals from '../../signals';
import socketHandler from './socketHandler';
import atomic from './atomic';
import backbutton from '../../backbutton';
import * as xhr from './roundXhr';
import { miniUser as miniUserXhr, toggleGameBookmark } from '../../xhr';
import { hasNetwork, saveOfflineGameData, boardOrientation } from '../../utils';
import m from 'mithril';

export default function controller(cfg, onFeatured, onTVChannelChange, userTv, onUserTVRedirect) {

  this.data = makeData(cfg);

  this.onTVChannelChange = onTVChannelChange;

  this.firstPly = function() {
    return this.data.steps[0].ply;
  }.bind(this);

  this.lastPly = function() {
    return this.data.steps[this.data.steps.length - 1].ply;
  }.bind(this);

  this.plyStep = function(ply) {
    return this.data.steps[ply - this.firstPly()];
  }.bind(this);

  this.vm = {
    flip: false,
    miniUser: {
      player: {
        showing: false,
        data: m.prop(null)
      },
      opponent: {
        showing: false,
        data: m.prop(null)
      }
    },
    showingActions: false,
    confirmResign: false,
    headerHash: '',
    replayHash: '',
    buttonsHash: '',
    playerHash: '',
    opponentHash: '',
    ply: this.lastPly(),
    moveToSubmit: null
  };

  const connectSocket = function() {
    if (utils.hasNetwork()) {
      socket.createGame(
        this.data.url.socket,
        this.data.player.version,
        socketHandler(this, onFeatured, onUserTVRedirect),
        this.data.url.round,
        userTv
      );
    }
  }.bind(this);

  connectSocket();

  // reconnect game socket after a cancelled seek
  signals.seekCanceled.add(connectSocket);

  this.stepsHash = function(steps) {
    var h = '';
    for (var i in steps) {
      h += steps[i].san;
    }
    return h;
  };

  this.toggleUserPopup = function(position, userId) {
    if (!this.vm.miniUser[position].data()) {
      this.vm.miniUser[position].data = miniUserXhr(userId);
    }
    this.vm.miniUser[position].showing = !this.vm.miniUser[position].showing;
  }.bind(this);

  this.showActions = function() {
    backbutton.stack.push(this.hideActions);
    this.vm.showingActions = true;
  }.bind(this);

  this.hideActions = function(fromBB) {
    if (fromBB !== 'backbutton' && this.vm.showingActions) backbutton.stack.pop();
    this.vm.showingActions = false;
  }.bind(this);

  this.flip = function() {
    if (this.data.tv) {
      if (m.route.param('flip')) m.route('/tv');
      else m.route('/tv?flip=1');
      return;
    } else if (this.data.player.spectator) {
      m.route('/game/' + this.data.game.id + '/' +
        utils.oppositeColor(this.data.player.color));
      return;
    }
    this.vm.flip = !this.vm.flip;
    this.chessground.set({
      orientation: boardOrientation(this.data, this.vm.flip)
    });
  }.bind(this);

  this.replaying = function() {
    return this.vm.ply !== this.lastPly();
  }.bind(this);

  this.jump = function(ply) {
    if (ply < this.firstPly() || ply > this.lastPly()) return false;
    const isFwd = ply > this.vm.ply;
    this.vm.ply = ply;
    const s = this.plyStep(ply);
    const config = {
      fen: s.fen,
      lastMove: s.uci ? [s.uci.substr(0, 2), s.uci.substr(2, 2)] : null,
      check: s.check,
      turnColor: this.vm.ply % 2 === 0 ? 'white' : 'black'
    };
    if (!this.replaying()) {
      config.movable = {
        color: gameApi.isPlayerPlaying(this.data) ? this.data.player.color : null,
        dests: gameApi.parsePossibleMoves(this.data.possibleMoves)
      };
    }
    this.chessground.set(config);
    if (this.replaying()) this.chessground.stop();
    if (s.san && isFwd) {
      if (s.san.indexOf('x') !== -1) sound.capture();
      else sound.move();
    }
    return true;
  }.bind(this);

  this.jumpNext = function() {
    return this.jump(this.vm.ply + 1);
  }.bind(this);

  this.jumpPrev = function() {
    return this.jump(this.vm.ply - 1);
  }.bind(this);

  this.jumpFirst = function() {
    return this.jump(this.firstPly());
  }.bind(this);

  this.jumpLast = function() {
    return this.jump(this.lastPly());
  }.bind(this);

  this.setTitle = function() {
    if (this.data.tv)
      this.title = 'Lichess TV';
    else if (this.data.userTV)
      this.title = this.data.userTV;
    else if (gameStatus.started(this.data))
      this.title = gameApi.title(this.data);
    else if (gameStatus.finished(this.data))
      this.title = i18n('gameOver');
    else if (gameStatus.aborted(this.data))
      this.title = i18n('gameAborted');
    else
      this.title = 'lichess.org';
  };
  this.setTitle();

  this.sendMove = function(orig, dest, prom) {
    socket.getAverageLag(function(lag) {
      const move = {
        from: orig,
        to: dest
      };
      if (prom) move.promotion = prom;
      if (this.clock && lag !== undefined) {
        move.lag = Math.round(lag);
      }

      if (this.data.pref.submitMove) {
        setTimeout(function() {
          backbutton.stack.push(this.cancelMove);
          this.vm.moveToSubmit = move;
          m.redraw();
        }.bind(this), this.data.pref.animationDuration || 0);
      } else {
        socket.send('move', move, { ackable: true });
        if (this.data.game.speed === 'correspondence' && !hasNetwork()) {
          window.plugins.toast.show('You need to be connected to Internet to send your move.', 'short', 'center');
        }
      }
    }.bind(this));
  };

  this.cancelMove = function(fromBB) {
    if (fromBB !== 'backbutton') backbutton.stack.pop();
    this.vm.moveToSubmit = null;
    this.jump(this.vm.ply);
  }.bind(this);

  this.submitMove = function(v) {
    if (v) {
      if (this.vm.moveToSubmit) {
        socket.send('move', this.vm.moveToSubmit, {
          ackable: true
        });
        if (this.data.game.speed === 'correspondence' && !hasNetwork()) {
          window.plugins.toast.show('You need to be connected to Internet to send your move.', 'short', 'center');
        }
      }
      this.vm.moveToSubmit = null;
    } else {
      this.cancelMove();
    }
  }.bind(this);

  var userMove = function(orig, dest, meta) {
    if (!promotion.start(this, orig, dest, meta.premove)) this.sendMove(orig, dest);
  }.bind(this);

  var onMove = function(orig, dest, capturedPiece) {
    if (capturedPiece) {
      if (this.data.game.variant.key === 'atomic') {
        atomic.capture(this.chessground, dest);
        sound.explosion();
      }
      else {
        sound.capture();
      }
    } else {
      sound.move();
    }

    if (!this.data.player.spectator) {
      vibrate.quick();
    }
  }.bind(this);

  this.apiMove = function(o) {
    const d = this.data;
    d.game.turns = o.ply;
    d.game.player = o.ply % 2 === 0 ? 'white' : 'black';
    const playedColor = o.ply % 2 === 0 ? 'black' : 'white';
    if (o.status) {
      d.game.status = o.status;
    }
    var wDraw = d[d.player.color === 'white' ? 'player' : 'opponent'].offeringDraw;
    var bDraw = d[d.player.color === 'black' ? 'player' : 'opponent'].offeringDraw;
    if (!wDraw && o.wDraw) {
      sound.dong();
      vibrate.quick();
    }
    if (!bDraw && o.bDraw) {
      sound.dong();
      vibrate.quick();
    }
    wDraw = o.wDraw;
    bDraw = o.bDraw;
    d.possibleMoves = d.player.color === d.game.player ? o.dests : null;
    this.setTitle();

    if (!this.replaying()) {
      this.vm.ply++;

      const enpassantPieces = {};
      if (o.enpassant) {
        const p = o.enpassant;
        enpassantPieces[p.key] = null;
        if (d.game.variant.key === 'atomic') {
          atomic.enpassant(this.chessground, p.key, p.color);
        } else {
          sound.capture();
        }
      }

      const castlePieces = {};
      if (o.castle && !this.chessground.data.autoCastle) {
        const c = o.castle;
        castlePieces[c.king[0]] = null;
        castlePieces[c.rook[0]] = null;
        castlePieces[c.king[1]] = {
          role: 'king',
          color: c.color
        };
        castlePieces[c.rook[1]] = {
          role: 'rook',
          color: c.color
        };
      }

      const pieces = Object.assign({}, enpassantPieces, castlePieces);
      this.chessground.apiMove(
        o.uci.substr(0, 2),
        o.uci.substr(2, 2),
        pieces,
        {
          turnColor: d.game.player,
          movable: {
            dests: gameApi.isPlayerPlaying(d) ? gameApi.parsePossibleMoves(d.possibleMoves) : {}
          },
          check: o.check
        }
      );

      if (o.promotion) {
        ground.promote(this.chessground, o.promotion.key, o.promotion.pieceClass);
      }

      if (playedColor !== d.player.color && this.chessground.data.premovable.current) {
        // atrocious hack to prevent race condition
        // with explosions and premoves
        // https://github.com/ornicar/lila/issues/343
        const premoveDelay = d.game.variant.key === 'atomic' ? 100 : 10;
        setTimeout(this.chessground.playPremove, premoveDelay);
      }
    }

    if (o.clock) {
      const c = o.clock;
      if (this.clock) this.clock.update(c.white, c.black);
      else if (this.correspondenceClock) this.correspondenceClock.update(c.white, c.black);
    }

    d.game.threefold = !!o.threefold;
    d.steps.push({
      ply: this.lastPly() + 1,
      fen: o.fen,
      san: o.san,
      uci: o.uci,
      check: o.check
    });
    gameApi.setOnGame(d, playedColor, true);

    if (this.data.game.speed === 'correspondence') {
      session.refresh();
      saveOfflineGameData(m.route.param('id'), this.data);
    }

  }.bind(this);

  this.chessground = ground.make(this.data, cfg.game.fen, userMove, onMove);

  this.clock = this.data.clock ? new clockCtrl(
    this.data.clock,
    this.data.player.spectator ? utils.noop :
      throttle(() => socket.send('outoftime'), 500),
    this.data.player.spectator ? null : this.data.player.color
  ) : false;

  this.isClockRunning = function() {
    return this.data.clock && gameApi.playable(this.data) &&
      ((this.data.game.turns - this.data.game.startedAtTurn) > 1 || this.data.clock.running);
  }.bind(this);

  this.clockTick = function() {
    if (this.isClockRunning()) this.clock.tick(this.data.game.player);
  }.bind(this);

  var makeCorrespondenceClock = function() {
    if (this.data.correspondence && !this.correspondenceClock)
      this.correspondenceClock = new correspondenceClockCtrl(
        this,
        this.data.correspondence,
        () => socket.send('outoftime')
      );
  }.bind(this);
  makeCorrespondenceClock();

  var correspondenceClockTick = function() {
    if (this.correspondenceClock && gameApi.playable(this.data))
      this.correspondenceClock.tick(this.data.game.player);
  }.bind(this);

  var clockIntervId;
  if (this.clock) clockIntervId = setInterval(this.clockTick, 100);
  else if (this.correspondenceClock) clockIntervId = setInterval(correspondenceClockTick, 6000);

  this.chat = (session.isKidMode() || this.data.opponent.ai || this.data.player.spectator) ?
    null : new chat.controller(this);

  this.notes = this.data.game.speed === 'correspondence' ? new notes.controller(this) : null;

  this.reload = function(rCfg) {
    if (this.stepsHash(rCfg.steps) !== this.stepsHash(this.data.steps))
      this.vm.ply = rCfg.steps[rCfg.steps.length - 1].ply;
    if (this.chat) this.chat.onReload(rCfg.chat);
    if (this.data.tv) rCfg.tv = this.data.tv;
    if (this.data.userTV) rCfg.userTV = this.data.userTV;
    if (this.data.tournament) rCfg.tournament = this.data.tournament;

    this.data = makeData(rCfg);

    makeCorrespondenceClock();
    if (this.clock) this.clock.update(this.data.clock.white, this.data.clock.black);
    this.setTitle();
    if (!this.replaying()) ground.reload(this.chessground, this.data, rCfg.game.fen, this.vm.flip);
    m.redraw();
  }.bind(this);

  var reloadGameData = function() {
    xhr.reload(this).then(this.reload);
  }.bind(this);

  this.toggleBookmark = function() {
    return toggleGameBookmark(this.data.game.id).then(reloadGameData);
  }.bind(this);

  var onResize = function() {
    this.vm.replayHash = '';
  }.bind(this);

  document.addEventListener('resume', reloadGameData);
  window.addEventListener('resize', onResize);
  window.plugins.insomnia.keepAwake();

  this.onunload = function() {
    socket.destroy();
    clearInterval(clockIntervId);
    document.removeEventListener('resume', reloadGameData);
    window.removeEventListener('resize', onResize);
    window.plugins.insomnia.allowSleepAgain();
    signals.seekCanceled.remove(connectSocket);
    if (this.chat) this.chat.onunload();
    if (this.chessground) {
      this.chessground.onunload();
    }
  };
}
