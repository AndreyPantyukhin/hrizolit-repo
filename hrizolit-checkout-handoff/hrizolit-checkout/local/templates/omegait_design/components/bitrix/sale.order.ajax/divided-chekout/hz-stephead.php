<?php
/**
 * /local/templates/omegait_design/components/bitrix/sale.order.ajax/template1/hz-stephead.php
 * Шапки шагов: строка «способ получения + Изменить», заголовки секций, «Назад».
 * Подключается внутри .hz-main (после #bx-soa-total-mobile). Видимость переключает hz-checkout.js по data-hz-for.
 *
 * @var Closure $hzMsg
 * @var string  $hzCity
 */
if (!defined('B_PROLOG_INCLUDED') || B_PROLOG_INCLUDED !== true)
{
	die();
}
?>
<div class="hz-stephead" data-hz-stephead data-hz-for="2,3" hidden>
	<div>
		<div class="hz-stephead__title" data-hz-stephead-title></div>
		<div class="hz-stephead__sub" data-hz-stephead-sub hidden></div>
	</div>
	<a href="#" class="hz-link" data-hz-goto="1"><?=htmlspecialcharsbx($hzMsg('HZ_CHANGE', 'Изменить'))?></a>
</div>

<h2 class="hz-heading" style="order:5" data-hz-for="1" data-hz-scenario="delivery" hidden><?=htmlspecialcharsbx($hzMsg('HZ_H_DELIVERY', 'Способ получения'))?></h2>
<h2 class="hz-heading" style="order:5" data-hz-for="1" data-hz-scenario="pickup" hidden><?=htmlspecialcharsbx($hzMsg('HZ_H_PICKUP', 'Выберите магазин для самовывоза'))?></h2>
<div class="hz-subline" data-hz-for="1" data-hz-scenario="pickup" hidden><?=htmlspecialcharsbx($hzCity)?></div>
<h2 class="hz-heading" style="order:40" data-hz-for="2" hidden><?=htmlspecialcharsbx($hzMsg('HZ_H_DATA', 'Ваши данные'))?></h2>
<h2 class="hz-heading" style="order:5" data-hz-for="3" hidden><?=htmlspecialcharsbx($hzMsg('HZ_H_PAYMENT', 'Способ оплаты'))?></h2>

<div class="hz-back" data-hz-for="2,3" hidden>
	<a href="#" class="hz-link" data-hz-goto="prev"><?=htmlspecialcharsbx($hzMsg('HZ_BACK', 'Назад'))?></a>
</div>
