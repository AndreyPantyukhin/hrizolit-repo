<?php
/**
 * /local/templates/omegait_design/components/bitrix/sale.order.ajax/template1/hz-bar.php
 * Фиксированная нижняя панель: согласие на обработку ПД, кнопки шагов и индикатор «N из 3».
 * #bx-soa-orderSave и кнопка [data-save-button] нужны штатному JS (bindEvents) — они остаются в DOM.
 * ВАЖНО: подключается ВНУТРИ #bx-soa-order (последним дочерним элементом, перед его закрывающим </div>).
 * Штатный JS ищет блок согласия на ПД через BX.UserConsent.load(#bx-soa-order); если панель вынести за его
 * пределы, подписка на согласие не создаётся и кнопка «Оплатить» ничего не делает. Панель position: fixed,
 * поэтому место в DOM на вид не влияет.
 *
 * @var array   $arParams
 * @var array   $arResult
 * @var CMain   $APPLICATION
 * @var array   $hzCfg
 * @var Closure $hzMsg
 */
if (!defined('B_PROLOG_INCLUDED') || B_PROLOG_INCLUDED !== true)
{
	die();
}

$hzStep1Label = $hzCfg['scenario'] === 'pickup'
	? $hzMsg('HZ_STEP_PICKUP', 'Пункт самовывоза')
	: $hzMsg('HZ_STEP_DELIVERY', 'Доставка');
$hzCartUrl = htmlspecialcharsbx((string)($arParams['PATH_TO_BASKET'] ?? '/personal/cart/'));
?>
<div class="hz-bar">
	<div class="hz-bar__inner">
		<div id="bx-soa-orderSave">
			<div class="checkbox hz-bar__consent" data-hz-for="2,3" hidden>
				<?php
				if (($arParams['USER_CONSENT'] ?? 'N') === 'Y')
				{
					$APPLICATION->IncludeComponent(
						'bitrix:main.userconsent.request',
						'',
						array(
							'ID' => $arParams['USER_CONSENT_ID'],
							'IS_CHECKED' => $arParams['USER_CONSENT_IS_CHECKED'],
							'IS_LOADED' => $arParams['USER_CONSENT_IS_LOADED'],
							'AUTO_SAVE' => 'N',
							'SUBMIT_EVENT_NAME' => 'bx-soa-order-save',
							'REPLACE' => array(
								'button_caption' => $hzMsg('HZ_PAY', 'Оплатить'),
								'fields' => $arResult['USER_CONSENT_PROPERTY_DATA']
							)
						)
					);
				}
				?>
			</div>
			<a href="#" class="hz-btn" data-hz-next><?=htmlspecialcharsbx($hzMsg('HZ_NEXT_1', 'Ваши данные'))?></a>
			<a href="javascript:void(0)" class="hz-btn" data-save-button="true" hidden><?=htmlspecialcharsbx($hzMsg('HZ_PAY', 'Оплатить'))?></a>
		</div>
	</div>

	<div class="hz-bar__counter" data-hz-counter>1 <?=htmlspecialcharsbx($hzMsg('HZ_OF', 'из'))?> 3</div>

	<ol class="hz-steps">
		<li class="hz-steps__item is-current" data-hz-step-item="1">
			<a class="hz-steps__pill" href="<?=$hzCartUrl?>"><?=htmlspecialcharsbx($hzMsg('HZ_STEP_NO', 'Шаг №'))?>1</a>
			<span class="hz-steps__pill"><?=htmlspecialcharsbx($hzStep1Label)?></span>
		</li>
		<li class="hz-steps__item" data-hz-step-item="2">
			<span class="hz-steps__pill"><?=htmlspecialcharsbx($hzMsg('HZ_STEP_NO', 'Шаг №'))?>2</span>
			<span class="hz-steps__pill"><?=htmlspecialcharsbx($hzMsg('HZ_STEP_DATA', 'Ваши данные'))?></span>
		</li>
		<li class="hz-steps__item" data-hz-step-item="3">
			<span class="hz-steps__pill"><?=htmlspecialcharsbx($hzMsg('HZ_STEP_NO', 'Шаг №'))?>3</span>
			<span class="hz-steps__pill"><?=htmlspecialcharsbx($hzMsg('HZ_STEP_PAYMENT', 'Оплата'))?></span>
		</li>
	</ol>
</div>
