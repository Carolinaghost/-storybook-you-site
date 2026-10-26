// Christmas bar across the top of the shop pages, 27 Oct - 24 Dec.
//
// One file so the dates live in one place. Days are counted in US Eastern
// time, the same clock the printed-copy cutoff is promised in. Until 4 December
// it pushes printed copies (they take 12-14 business days); after that only the
// emailed PDF can still make it, so it says that instead. After the 24th it
// shows nothing, and this file can be deleted or re-dated for next year.
(function () {
  function easternToday() {
    try {
      var p = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' })
        .formatToParts(new Date());
      var get = function (t) { return (p.find(function (x) { return x.type === t; }) || {}).value; };
      return get('year') + '-' + get('month') + '-' + get('day');
    } catch (e) {
      return new Date().toISOString().slice(0, 10);
    }
  }
  var today = easternToday();
  var year = today.slice(0, 4);
  var printCutoff = year + '-12-04';
  var lastDay = year + '-12-24';
  // Exposed so the order step can show its own cutoff line from the same date.
  window.CRAYONAUTS_PRINT_CUTOFF_OPEN = today <= printCutoff;
  if (today > lastDay || today < year + '-10-27') return;

  var text = today <= printCutoff
    ? 'Christmas theme is here · Order printed copies by 4 December'
    : 'Christmas theme is here · Emailed in about 10 minutes, print at home';

  function add() {
    if (document.getElementById('holidayBar')) return;
    var bar = document.createElement('a');
    bar.id = 'holidayBar';
    bar.href = '/?theme=Christmas#start';
    bar.textContent = text;
    bar.setAttribute('style', [
      'display:block', 'background:#242636', 'color:#FDF8F0', 'text-align:center',
      'font:600 14px/1.4 Karla, Helvetica, Arial, sans-serif', 'padding:9px 14px',
      'text-decoration:none', 'letter-spacing:.2px'
    ].join(';'));
    document.body.insertBefore(bar, document.body.firstChild);
  }
  if (document.body) add(); else document.addEventListener('DOMContentLoaded', add);
})();
