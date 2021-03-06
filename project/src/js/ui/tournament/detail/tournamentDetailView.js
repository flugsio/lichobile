import { header as headerWidget, pad, backButton } from '../../shared/common';
import layout from '../../layout';
import m from 'mithril';
import i18n from '../../../i18n';
import { gameIcon } from '../../../utils';
import helper from '../../helper';
import settings from '../../../settings';

export default function view(ctrl) {
  const headerCtrl = headerWidget.bind(undefined, null,
    backButton(ctrl.tournament() ? ctrl.tournament().fullName : null)
  );

  const bodyCtrl = tournamentBody.bind(undefined, ctrl);

  return layout.free(headerCtrl, bodyCtrl, renderFooter.bind(undefined, ctrl));
}

function tournamentBody(ctrl) {
  const data = ctrl.tournament();

  if (!data) return null;

  let body;

  if (data.isFinished) {
    body = tournamentContentFinished(ctrl);
  }
  else if (!data.isStarted) {
    body = tournamentContentCreated(ctrl);
  }
  else {
    body = tournamentContentStarted(ctrl);
  }

  return (
    <div class="tournamentContainer native_scroller page withFooter">
      {body}
    </div>
  );
}

function tournamentContentFinished(ctrl) {
  const data = ctrl.tournament();
  return [
    tournamentHeader(data, null, null),
    tournamentLeaderboard(ctrl, true)
  ];
}

function tournamentContentCreated(ctrl) {
  const data = ctrl.tournament();
  return [
    tournamentHeader(data, data.secondsToStart, 'Starts in:'),
    tournamentLeaderboard(ctrl, false)
  ];
}

function tournamentContentStarted(ctrl) {
  const data = ctrl.tournament();
  return [
      tournamentHeader(data, data.secondsToFinish, ''),
      tournamentLeaderboard(ctrl, false),
      data.featured ? tournamentFeaturedGame(data) : ''
  ];
}

function tournamentHeader(data, time, timeText) {
  const variant = variantDisplay(data);
  const control = timeControl(data);
  return (
    <div className="tournamentHeader">
      <div className="tournamentInfoTime">
        <strong className="tournamentInfo" data-icon={gameIcon(variantKey(data))} > {variant + ' • ' + control + ' • ' + data.minutes + 'M' } </strong>
        <div className="timeInfo">
          <strong> {timeInfo(time, timeText)} </strong>
        </div>
      </div>
      <div className="tournamentCreatorInfo">
        { data.createdBy === 'lichess' ? i18n('tournamentOfficial') : i18n('by', data.createdBy) }
        &nbsp;•&nbsp;
        { window.moment(data.startsAt).calendar() }
      </div>
   </div>
  );
}

function tournamentJoinWithdraw(ctrl) {
  const label = ctrl.hasJoined() ? i18n('withdraw') : i18n('join');
  const icon = 'fa ' + (ctrl.hasJoined() ? 'fa-flag' : 'fa-play');

  function buttonAction () {
    if (ctrl.hasJoined()) {
      ctrl.withdraw(ctrl.tournament().id);
    }
    else {
      ctrl.join(ctrl.tournament().id);
    }
  }

  if (ctrl.tournament().isFinished || settings.game.supportedVariants.indexOf(ctrl.tournament().variant) < 0) {
    return null;
  }

  return (
    <button className="action_bar_button" config={helper.ontouch(buttonAction)}>
      <span className={icon} />
      {label}
    </button>
  );
}

function variantDisplay(data) {
  let variant = variantKey(data);

  variant = variant.split(' ')[0]; // Cut off names to first word

  if (variant.length > 0) {
    variant = variant.charAt(0).toUpperCase() + variant.substring(1);
  }

  return variant;
}

function variantKey(data) {
  let variant = data.variant;
  if (variant === 'standard') {
    variant = data.perf.name.toLowerCase();
  }
  return variant;
}

function timeControl(data) {
  let limit = (data.clock.limit / 60);
  if (data.clock.limit === 30)
    limit = '½';
  else if (data.clock.limit === 45)
    limit = '¾';
  return limit + '+' + data.clock.increment;
}

function timeInfo(time, preceedingText) {
  if (!time) return '';

  let timeStr = '';
  const hours = Math.floor(time / 60 / 60);
  const mins = Math.floor(time / 60) - (hours * 60);
  const secs = time % 60;
  if (hours > 0)
    timeStr = preceedingText + ' ' + hours + ':' + pad(mins, 2) + ':' + pad(secs, 2);
  else
    timeStr = preceedingText + ' ' + mins + ':' + pad(secs, 2);
  return timeStr;
}

function tournamentLeaderboard(ctrl, showTrophies) {
  const data = ctrl.tournament();
  return (
    <div className='tournamentLeaderboard'>
      <p className='tournamentTitle'> {i18n('leaderboard')} ({data.nbPlayers} Players)</p>
      <table className='tournamentStandings'>
        {data.standing.players.map(createLeaderboardItemRenderer(showTrophies))}
      </table>
    </div>
  );
}

function createLeaderboardItemRenderer(showTrophies) {
  function renderLeaderboardItem(player) {
    let trophy = '';
    if (showTrophies && player.rank < 4) {
      trophy = 'trophy-' + player.rank;
    }
    return (
      <tr key={player.name} className='list_item'>
        <td className='tournamentPlayer'><span className={trophy}>{player.rank + '. ' + player.name + ' (' + player.rating + ') '} {helper.progress(player.ratingDiff)} </span></td>
        <td className='tournamentPoints'><span className={player.sheet.fire ? 'on-fire' : 'off-fire'} data-icon='Q'>{player.score}</span></td>
      </tr>
    );
  }
  return renderLeaderboardItem;
}

function tournamentFeaturedGame(data) {
  return (
    <div className='tournamentGames'>
      <p className='tournamentTitle'>Featured Game</p>
      <div class='featuredGame nav' config={helper.ontouchY(() => m.route('/tournament/' + data.id + '/game/' + data.featured.id))}>
          {data.featured.white.name} ({data.featured.white.rating}) vs. {data.featured.black.name} ({data.featured.black.rating})
      </div>
    </div>
  );
}

function renderFooter(ctrl) {
  return (
    <div className="actions_bar">
      {tournamentJoinWithdraw(ctrl)}
    </div>
  );
}

