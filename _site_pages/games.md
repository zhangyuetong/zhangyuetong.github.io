---
title: Games
---

<div class="card-grid">
{% for game in site.games %}
  {% include game-card.html game=game %}
{% endfor %}
</div>

{% if site.games.size == 0 %}
<p class="empty-state">No games yet.</p>
{% endif %}
