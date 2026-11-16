<?php
/**
 * /local/templates/omegait_design/components/bitrix/sale.order.ajax/template1/hz-aside.php
 * Карточка «Программа лояльности» в сайдбаре (сводку заказа рисует hz-checkout.js).
 * Для авторизованных пока не выводится: логика лояльности (скидка по телефону из 1С) — отдельный этап.
 *
 * @var array   $arParams
 * @var CUser   $USER
 * @var Closure $hzMsg
 */
if (!defined('B_PROLOG_INCLUDED') || B_PROLOG_INCLUDED !== true)
{
	die();
}

if (!$USER->IsAuthorized())
{
	?>
	<div class="hz-card">
		<h3 class="hz-card__title"><?=htmlspecialcharsbx($hzMsg('HZ_LOYALTY_TITLE', 'Программа лояльности'))?></h3>
		<p class="hz-card__text"><?=htmlspecialcharsbx($hzMsg('HZ_LOYALTY_TEXT', 'Войдите в личный кабинет, чтобы просмотреть баллы, статус и персональные предложения.'))?></p>
		<a class="hz-btn hz-btn--outline" href="<?=htmlspecialcharsbx((string)($arParams['PATH_TO_PERSONAL'] ?? '/personal/'))?>"><?=htmlspecialcharsbx($hzMsg('HZ_LOYALTY_LOGIN', 'Войти в кабинет'))?></a>
	</div>
	<?php
}
