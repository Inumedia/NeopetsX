/*var js = document.createElement('script');
js.setAttribute('data-base', chrome.extension.getURL('/'));
js.src = chrome.extension.getURL("js/main.js?v=1_" + new Date().getTime());
js.id='mainJS';
document.body.appendChild(js);*/
document.$ = $;

var mShopWizardStates = { "None": 0, "Searching": 1 };
var mShopUpdateStates = { "Updating": 0, "DoneUpdatingPage": 1 };

var mStates = 	{
					'idle': { status: "idle" },
					'wondering': { status: "wondering", readyToChange: 0, currentLocation: "http://neopets.com/index.phtml" },
					'gettingItemsInShop': { status: "gettingItemsInShop", readyToChange: 0, currentPage: 0, itemsInShop: [] },
					'gettingAveragePrice': { status: "gettingAveragePrice", readyToChange: 0, state: null, currentItem: 0, itemsToCheck: [] },
					'updatingItemsInShop': { status: "updatingItemsInShop", readyToChange: 0, currentPage: -1, itemsWithPrices: [], state: 0 },
					'playingTombola': { status: "playingTombola", readyToChange: 0, state: 0 },
					'playingDesertedTomb': { status: "playingDesertedTomb", readyToChange: 0, state: 0 },
					'grabJelly': { status: "grabJelly", readyToChange: 0, state: 0 },
					'doMeteorCrash': { status: "doMeteorCrash", readyToChange: 0, state: 0 },
					'solveLunarTemple': { status: "solveLunarTemple", readyToChange: 0, state: 0 },
					'TDMBGPOP': { status: "TDMBGPOP", readyToChange: 0, state: 0 },
					'getObsidian': { status: "getObsidian", readyToChange: 0 },
					'weltrudesToyChest': { status: "weltrudesToyChest", readyToChange: 0, state: 0 },
					'slorgPayout': { status: "slorgPayout", readyToChange: 0 },
					'fruitMachine': { status: "fruitMachine", readyToChange: 0, state: 0 },
					'coltzansShrine': { status: "coltzansShrine", readyToChange: 0, state: 0 },
					'healingSprings': { status: "healingSprings", readyToChange: 0, state: 0 },
					'anchorManagement': { status: "anchorManagement", readyToChange: 0, state: 0 },
					'eval': {status: "eval", readyToChange: 0, state: 0, script: null}
				};
				
var mAutoExec = {
					'/auctions.phtml': autoAuction,
					'/market.phtml': autoShop,
					'/objects.phtml': autoObjects
				};

var mCurrentState;
var mCallbacks = [];
var mBase = chrome.extension.getURL('/');
var mStopped = 0;
var mGotoIndexWhenDone = 1;
var mStatus = null;
var mIsActive = true;
var mHold = false;

var WAIT_WONDER = 25000;
var WAIT_SHOPUPDATE = 30000;
var WAIT_SHOPTRANSITION = 10000;
var WAIT_SHOPMOVE = 5000;
var WAIT_SHOPWIZARD = 5000;
var WAIT_SHOPWIZARD_RETRY = 5000;
var WAIT_MOVETODAILY = 5000;
var WAIT_DODAILY = 3000;
var WAIT_AUTOAUCTIONUPDATE = 5000;
var WAIT_AUTOAUCTIONLOTUPDATE = 3000;

function require(url, pOnLoad, pProcessing){
  var element;
  switch(url.split(".").pop()){
    case "css":{
      element=document.createElement("link");
      element.setAttribute("rel","stylesheet");
      element.setAttribute("type","text/css");
      element.setAttribute("href",url + "?nocache="+Math.random());
	  if(pOnLoad != null)
		element.onload = function(){ pOnLoad(); } ;//.setAttribute("onload", pOnLoad);
    }break;
    case "js":{	
      element=document.createElement("script");
      element.setAttribute("language","javascript")
      element.setAttribute("src",url)
	  if(pOnLoad != null)
		element.onload = function(){ pOnLoad(); };//setAttribute("onload", pOnLoad);
    }break;
    default:{
	throw "Could not get required include " + url;}
	return;
  }
  var head=document.querySelector("head");
  if(head.innerHTML.indexOf(element.outerHTML)!=-1){
    window.console && window.console.warn("Duplicate include, skipping:",url);
  }else{
	if(pProcessing != null) pProcessing(element);
    head.appendChild(element);
  }
}
function Main(){
	Log("Loading");
	var sCurrentState = localStorage['currentState'];
	var sUndefinedState = sCurrentState == 'undefined' || sCurrentState == null;
	if(sUndefinedState) mCurrentState = mStates.idle;
	else mCurrentState = JSON.parse(localStorage['currentState']);
	if(!mCurrentState || !mCurrentState.status || mCurrentState.readyToChange) mCurrentState = mStates.idle;
	Log("Current State:" + mCurrentState.status);
	
	var sScripts = document.getElementsByTagName("SCRIPT");
	var sHead = document.getElementsByTagName("head")[0];
	console.log(chrome);
	Initialize();
}
function Design(){
	Log("Nobody likes an over-bearing parent. Or advertisements.");
	$("script[src!='']").filter(function(i,e){ return (!e.src.match("neopets") && !e.src.match("google-analytics")) }).remove();
	$(".adBox, .ad_wrapper, #pushdown_banner, .brand-mamabar, .ad_wrapper_fixed, iframe[height=90]").remove();
	$("#ban").html("");
	AppendSidebarModule("Status", "<div id='inuStatus'><p>Initializing</p></div>");
	//$("#nst").parent().append("<td id='inuStatus'>Initializing.</td>");
	mStatus = $("#inuStatus").css("max-height", "250px").css("overflow", "auto");
	$(".sidebarModule").width("90%");
	$(".sidebarModule table").width("100%");
	$("a[href='/index.phtml'] > img").prop("src",mBase+"img/header.png").width("155px").height("46px");
	$("#header > table > tbody> tr > td > a[href='/index.phtml']").parent().css("vertical-align","bottom");
}
function Flush(){
	Log("Flushing new state:" + mCurrentState.status);
	localStorage['currentState'] = JSON.stringify(mCurrentState);
}
function Log(pLog){
	console.log(/*util.nowStr()+*/"AutoNeopets >>> " + pLog);
	if(mStatus != null) mStatus.append('<p>' + pLog + "</p>");
}
function Avg(pArray){
	sTotal = 0;
	for(sVar in pArray)
		sTotal = sTotal + pArray[sVar];
	return sTotal / pArray.length;
}
function Done(){
	mCurrentState.readyToChange = 1;
	Flush();
	Log("Done.");
	if(mGotoIndexWhenDone)
		setTimeout(function(){
			window.location = "http://neopets.com/index.phtml";
		}, WAIT_MOVETODAILY);
}
function Stop(){ mStopped = 1; }
function Initialize(){
	Log("Initializing");
	Design();
	
	$(window).focus(function(){ mIsActive = true; });
	$(window).blur(function(){  mIsActive = false });
	
	mCallbacks['idle'] = (function(){
		Log("Idle.");
	});
	mCallbacks[null] = mCallbacks['idle'];
	mCallbacks['wondering'] = Wonder;
	mCallbacks['gettingItemsInShop'] = GetItemsInShop;
	mCallbacks['gettingAveragePrice'] = GetAveragePrices;
	mCallbacks['updatingItemsInShop'] = UpdateShopPrices;
	mCallbacks['anchorManagement'] = AnchorManagement;
	mCallbacks['healingSprings'] = HealingSprings;
	mCallbacks['coltzansShrine'] = ColtzansShrine;
	mCallbacks['fruitMachine'] = FruitMachine;
	mCallbacks['eval'] = function(){ eval(mCurrentState.script); };
	if(mAutoExec[window.location.pathname]) mAutoExec[window.location.pathname]();
	
	if(mCallbacks[mCurrentState.status] != null)
		mCallbacks[mCurrentState.status]();
	else
		Log("Couldn't find callback for state.  Not executing.");
}
function autoShop(){
	if(!window.location.search) return;
	if(window.location.search.match("^\\?type=your") || window.location.search.match("^\\?type=till"))
	{
		$(".content table[width='100%']").width("75%");
		var sAutoPrice = $("<b><a href='#' id='autoPrice'>Auto Price</a></b>");
		sAutoPrice.click(function(event){ event.preventDefault(); GetItemsInShop(); });
		$(".contentModuleContent span").append(" | ").append(sAutoPrice);
		$(".content table[width='100%'] td[width]").remove();
	}else if(window.location.search.match("^\\?type=wizard")){
		$("select[name=criteria]").val("exact");
		$(".content > div:eq(0)").remove();
		$(".content > div:eq(0)").css("display", "inline-block").css("float", "left");
		$(".content").append("<div id='shopWizardResults'></div>");
		var sForm = $("form[action='market.phtml']");
		$("form[action='market.phtml'], .content input[type=submit]").submit(function(event){
			event.preventDefault();
			$.post('./market.phtml', sForm.serialize(), function(pData){
				var sResults = $(pData);
				sResults = sResults.find(".content table[width=600]");
				if(!sResults.length) sResults = "<p>Couldn't find any results, sorry. :(</p>";
				$("#shopWizardResults").hide().html(sResults).fadeIn();
			});
		});
		$(".content").prepend($("div[align=center].medText"));
	}
}
function autoAuction(){
	//console.log("Auto Auction Refresher active.")
	if(!window.location.search || window.location.search.match("^\\?auction_counter.*")){
		setInterval(RefreshAuctions, WAIT_AUTOAUCTIONUPDATE);
		SetBidClickable();
		SetIDs(rows = $(".content center table tbody").children());
		$("body").click(function(event){ 
			if(event.isDefaultPrevented && event.isDefaultPrevented()) return;
			var sParents = $(".bid").parent();
			for(var i = 0; i < sParents.length; ++i){
				var sParent = $(sParents[i]);
				sParent.html(sParent.attr("curprice"));
			}
			RefreshAuctions();
		});
	}if(window.location.search.match("^\\?type=bids.*")){
		$("form[action=auctions.phtml?type=placebid] input").click(function(event){
			event.preventDefault();
		}).focus(function(){ mHold = true; }).blue(function(){ mHold = false; });
		$("body").click(function(event){ 
			if(event.isDefaultPrevented && event.isDefaultPrevented()) return;
			var sParents = $(".bid").parent();
			for(var i = 0; i < sParents.length; ++i){
				var sParent = $(sParents[i]);
				sParent.html(sParent.attr("curprice"));
			}
			RefreshAuction();
		});
		var sForm = $("form[action='auctions.phtml?type=placebid'], form[action='auctions.phtml?type=placebid'] input[type=submit]").submit(function(event){ event.preventDefault(); $.post("./auctions.phtml?type=placebid", sForm.serialize(), function(pData){ RefreshAuction(); }) });
		setInterval(RefreshAuction, WAIT_AUTOAUCTIONLOTUPDATE);
	}
}
function autoObjects(){
	if(window.location.search && window.location.search.match("^\\?type=inventory"))
	{
		var sInventoryTables = $("tr td.contentModuleContent table");
		var sItems = GetInventoryItems();
		sInventoryTables.html("").css("text-align", "center");
		var sInventoryTable = $(sInventoryTables[0]);
		var sNeocashInventoryTable = $(sInventoryTables[1]);
		$(sItems.filter(function(e){ return e.itemPurchaseType == 'neopoints' })).each(function(i,e){
			var sDiv = $("<div class='itemBlock'>"+e.inventoryElement+"</div>");
			var sLink = sDiv.find("a:eq(0)").attr("href", null);
			var sItemID = sLink[0].onclick.toString().match(/[0-9]+/g)[0];
			sLink.attr("onclick", null);
			console.log(sItemID, sLink);
			sLink.attr("rel", "inventory").fancybox({
				onStart: function(){
					$.get("/iteminfo.phtml?obj_id="+sItemID, function(pData){
						var sData = $(pData);
						$("#fancybox-maincontent")
						.html(sData.filter("table:eq(0)"))
						.append(sData.find("span"))
						.append(sData.filter("table[width=410]"))
						.append(sData.filter("center").html());
						$("#fancybox-maincontent > table").css("margin", "auto");
						$("#fancybox-maincontent img").attr("border", null);
						var sForm = $("form[name=item_form]");
						$("form[name=item_form], form[name=item_form] input[type=submit]").submit(function(event){
							event.preventDefault();
							var sId = $("input[type=hidden][name=obj_id]").val();
							$.get("/useobject.phtml", sForm.serialize(), function(pData){
								console.log(pData);
								if($("input[type=hidden][name=obj_id]").val() == sId){
									var sContents = $(pData).find("center");
									if(!sContents.length) sContents = $(pData).filter("center");
									$("#fancybox-maincontent").html(sContents);
									
								}
							})
						});
					});
				},
				content: "<div id='fancybox-maincontent' style='width: 450px;height:350px;'>Loading</div>",
				showNavArrows: false
			});
			sInventoryTable.append(sDiv);
		});
		$(sItems.filter(function(e){ return e.itemPurchaseType == 'neocash' })).each(function(i,e){
			sNeocashInventoryTable.append("<div class='itemBlock'>"+e.inventoryElement+"</div>");
		});
		$(".content table[width='100%'] td[width]").remove();
	}
}
var sObj = null;
function SetBidClickable(){
	$(".content center table td:nth-child(7)[bgcolor!='#dddd77']").attr("isprice", true).click(function(event){
		event.preventDefault();
		var that = $(this);
		if(that.find('b').length && !that.attr('curprice')){
			that.attr("curprice", that.html());
			that.find('b').remove();
			that.html("");
			var href = that.siblings()[1].childNodes[0].href;
			$.get(href, function(pData){
				var sForm = $("<form class='bid'></form>");
				var sInputs = $(pData).find(".content form input");
				$(sInputs[3]).val("Bid").click(function(event){
					that.html("Bidding");
					console.log("Bidding on", href);
					event.preventDefault();
					$.post("./auctions.phtml?type=placebid", sForm.serialize(), RefreshAuctions);
				});
				sForm.append(sInputs);
				that.append(sForm);
				//sForm.submit();
			});
		}
	});
}
function RefreshAuction(){ 
	if(!mIsActive || mHold) return;
	$.get(window.location.href, function(pData){
		var sBids = $(pData).find(".content center table").html();
		var sForm = $(pData).find(".content center form").html();
		$(".content center table[cellspacing=0]").html(sBids);
		$(".content center form").html(sForm);
	}); 
}
function RefreshAuctions(){
	if(!mIsActive || $(".bid").length) return;
	$.get(window.location.href, function(pData){
		sObj = $(pData);
		var sMain = sObj.filter("#main")[0];
		var rows = $(sMain.getElementsByClassName("content")).children("center").children("table").children().children().filter("tr[bgcolor]");
		SetIDs(rows);
		UpdateAuctions(rows);
		//$(".content center table tbody").html(rows);
		SetBidClickable();
	});
}
function UpdateAuctions(newRows){
	var newHeadId = newRows[1].attributes["auctionid"].value;
	var oldRows = $(".content center table tbody tr[auctionid]");
	for(var i = 1; i < oldRows.length; ++i)
	{
	console.log(oldRows.length);
		var oldHead = $(oldRows[i]);
		if(oldHead.attr("auctionid") == newHeadId)
			break;
		
		oldHead.fadeOut(function(){ oldHead.remove(); });
	}
	
	
}
function SetIDs(rows){
	var idRegex = "auction_id=([0-9]*)";
	for(var i = 0; i < rows.length; ++i){
		if(!rows[i].bgColor) continue;
		var sEntry = $(rows[i]);
		var auctionId = sEntry.children().children("a")[0].href.match("auction_id=([0-9]*)")[1];
		sEntry.attr("auctionId", auctionId);
	}
}
function remoteGetAveragePrice(pItemName, pCallback){
	console.log($.post("http://www.neopets.com/market.phtml", {
		"type": "process_wizard",
		"feedset": 0,
		"shopwizard": pItemName,
		"table": "shop",
		"criteria": "exact",
		"min_price": "0",
		"max_price": "99999"
	}, function(pData){ 
		var sEntries = $(pData).filter("#main").find(".content tbody tr");
		var sPrices = [];
		if(sEntries.length > 2){
			sEntries = sEntries.find("td[align=right] b");
			for(var i = 0; i < sEntries.length; ++i){
				var sText = sEntries[i].innerHTML;
				var sValue = sText.substr(0,sText.length-3).replace(",","");
				console.log(sValue);
				sPrices.push(new Number(sValue));
			}
		}
		
		if(sPrices.length > 0)
			pCallback(sPrices, Avg(sPrices));
	}));
}
function GetInventoryItems(){
	var sItems = [];
	var sItemsHTML = $("td.contentModuleContent table > tbody > tr > td, div.itemBlock");
	sItemsHTML.each(function(i,e){
		var sRegexName = new RegExp("br>([a-zA-Z0-9 ]*)[<]*");
		var sRegexId = new RegExp("openwin\\(([0-9]*)\\);");
		var sMatchName = sRegexName.exec(e.innerHTML);
		var sMatchInventoryId = sRegexId.exec(e.innerHTML);
		var sTagsHTML = $(e).find("span.medText > b, span.medText > b > font")
		var sTags = [];
		sTagsHTML.each(function(i,e){ sTags.push(e.innerText); })
		if(sMatchName != null)
			if(sMatchInventoryId != null)
				sItems.push({
					itemName: sMatchName[1],
					itemTags: sTags,
					inventoryId: sMatchInventoryId[1],
					inventoryElement: e.innerHTML,
					itemPurchaseType: 'neopoints'
				});
			else
				sItems.push({
					itemName: sMatchName[1],
					itemTags: sTags,
					inventoryElement: e.innerHTML,
					itemPurchaseType: 'neocash'
				});
	});
	return sItems;
}
function GetDonatedItems(){
	var sItems = [];
	var sItemsHTML = $("td.contentModuleContent table > tbody > tr > td[width=120], div.itemBlock");
	sItemsHTML.each(function(i,e){
		console.log(e);
		var sRegexName = new RegExp("b>([a-zA-Z0-9 ]*)[<]*");
		var sLink = $(e).find("a");
		var sRegexDonated = new RegExp("\\(donated by ([a-zA-Z0-9_]*)\\)");
		var sName = sRegexName.exec(e.innerHTML);
		var sDonator = sRegexDonated.exec(e.innerHTML);
		if(sName != null) sName = sName[1]; else sName = "";
		if(sDonator != null) sDonator = sDonator[1]; else sDonator = "";
		sItems.push({
			itemElement: e,
			itemLink: sLink,
			itemName: sName,
			itemDonator: sDonator
		});
	});
	return sItems;
}
function AnchorManagement(){
	if(mCurrentState.state == 0){
		var sForm = $("form#form-fire-cannon");
		if(sForm.length == 0){
			Log("Moving to Anchor Management");
			setTimeout(function(){
				window.location = "http://www.neopets.com/pirates/anchormanagement.phtml?sc9ejf2=64209";
			}, WAIT_MOVETODAILY);
			return;
		}
		sForm.submit();
	}else if(mCurrentState.state == 1) Done();
}
function HealingSprings(){
	if(mCurrentState.state == 0){
		var sForm = $("form[action='springs.phtml']");
		if(sForm.length == 0){
			Log("Moving to Healing Springs.");
			setTimeout(function(){
				window.location = "http://www.neopets.com/faerieland/springs.phtml";
			}, WAIT_MOVETODAILY);
			return;
		}
		mCurrentState.state = 1;
		Flush();
		$("input[value='heal']").parent().submit();
	}else if(mCurrentState.state == 1) Done();
}
function ColtzansShrine(){
	if(mCurrentState.state == 0){
		var sForm = $("form[action='shrine.phtml']");
		if(sForm.length == 0){
			Log("Moving to Coltzan's Shrine.");
			setTimeout(function(){
				window.location = "http://www.neopets.com/desert/shrine.phtml";
			},WAIT_MOVETODAILY);
			return;
		}
		mCurrentState.state = 1;
		Flush();
		sForm.submit();
	}else if(mCurrentState.state == 1) Done();
}
function FruitMachine(){
	if(mCurrentState.state == 0){
		var sForm = $("form[action='fruitmachine2.phtml']");
		if(sForm.length == 0){
			Log("Moving to Fruit Machine.");
			setTimeout(function(){
				window.location = "http://www.neopets.com/desert/fruitmachine.phtml";
			}, WAIT_MOVETODAILY);
			return;
		}
		mCurrentState.state = 1;
		Flush();
		sForm.submit();
	}else if(mCurrentState.state == 1) Done();
}
function SlorgPayout(){
	if($("div#eyeLeaveBehind").length == 0){
		setTimeout(function(){
			window.location = "http://www.neopets.com/shop_of_offers.phtml?slorg_payout=yes";
		}, WAIT_DODAILY);
	}else Done();
}
function WeltrudesToyChest(){
	if(mCurrentState.state == 0){
		var sForm = $("form[action='/petpetpark/daily.phtml']");
		if(sForm.length == 0){
			Log("Moving to Weltrude's Toy Chest.");
			setTimeout(function(){
				window.location = "http://www.neopets.com/petpetpark/daily.phtml";
			}, WAIT_MOVETODAILY);
			return;
		}
		mCurrentState.state = 1;
		Flush();
		setTimeout(function(){sForm.submit()}, WAIT_DODAILY);
	}else if(mCurrentState.state == 1)
		Done();
}
function GetObsidian(){
	if($("form[action='/magma/index.phtml']").length == 0){
		setTimeout(function(){
			window.location = "http://www.neopets.com/magma/quarry.phtml";
		}, WAIT_DODAILY);
	}else Done();
}
function TDMBGPOP(){
	if(mCurrentState.state == 0){
		var sForm = $("input[name='talkto']");
		if(sForm.length == 0){
			Log("Moving to The Discarded Magical Blue Grundo Plushie of Prosperity.");
			setTimeout(function(){
				window.location = "http://www.neopets.com/faerieland/tdmbgpop.phtml";
			}, WAIT_MOVETODAILY);
			return;
		}
		mCurrentState.state = 1;
		Flush();
		setTimeout(function(){sForm.parent().submit()}, WAIT_DODAILY);
	}else if(mCurrentState.state == 1)
		Done();
}
///Not complete, buggy.
function SolveLunarTemple(){
	if(mCurrentState.state == 0){
		var sForm = $("form[action='results.phtml']");
		if(sForm.length == 0){
			Log("Moving to Lunar Temple Puzzle");
			setTimeout(function(){
				window.location = "http://www.neopets.com/shenkuu/lunar/?show=puzzle";
			}, WAIT_MOVETODAILY);
			return;
		}
		var sLink = swf.attributes.swf;
		var sAngle = new Number(swf.attributes.swf.split("&")[1].split("=")[1]);
		Log("I got the wrong answer on this?");
		var sAnswer = 0;
		if(sAngle >= 0 && sAngle <= 11)		sAnswer = 8;
		if(sAngle >= 12 && sAngle <= 33)	sAnswer = 9;
		if(sAngle >= 34 && sAngle <= 56)	sAnswer = 10;
		if(sAngle >= 57 && sAngle <= 78)	sAnswer = 11;
		if(sAngle >= 79 && sAngle <= 101)	sAnswer = 12;
		if(sAngle >= 102 && sAngle <= 123)	sAnswer = 13;
		if(sAngle >= 124 && sAngle <= 146)	sAnswer = 14;
		if(sAngle >= 147 && sAngle <= 168)	sAnswer = 15;
		if(sAngle >= 169 && sAngle <= 191)	sAnswer = 0;
		if(sAngle >= 192 && sAngle <= 213)	sAnswer = 1;
		if(sAngle >= 214 && sAngle <= 236)	sAnswer = 2;
		if(sAngle >= 237 && sAngle <= 258)	sAnswer = 3;
		if(sAngle >= 259 && sAngle <= 281)	sAnswer = 4;
		if(sAngle >= 282 && sAngle <= 303)	sAnswer = 5;
		if(sAngle >= 304 && sAngle <= 326)	sAnswer = 6;
		if(sAngle >= 327 && sAngle <= 348)	sAnswer = 7;
		if(sAngle >= 349 && sAngle <= 360)	sAnswer = 8;
		
		var sRadio = $("input[name='phase_choice'][value='"+sAnswer+"']");
	}
}
function DoMeteorCrash(){
	if(mCurrentState.state == 0){
		var sForm = $("form[action='/moon/meteor.phtml']");
		if(sForm.length == 0){
			Log("Moving to Meteor Crash Site.");
			setTimeout(function(){
				window.location = "http://www.neopets.com/moon/meteor.phtml";
			}, WAIT_MOVETODAILY);
			return;
		}
		mCurrentState.state = 1;
		Flush();
		setTimeout(function(){sForm.submit()}, WAIT_DODAILY);
	}else if(mCurrentState.state == 1){
		var sForm = $("form[action='/moon/process_meteor.phtml']");
		$("select[name='pickstep']").val(1);
		mCurrentState.state = 2;
		Flush();
		setTimeout(function(){sForm.submit()}, WAIT_DODAILY);
	}else if(mCurrentState.state == 2){
		Done();
	}
}
function GrabJelly(){
	if(mCurrentState.state == 0){
		var sForm = $("form[action='jelly.phtml']");
		if(sForm.length == 0){
			Log("Moving to get Jelly.");
			setTimeout(function(){
				window.location = "http://www.neopets.com/jelly/jelly.phtml";
			}, WAIT_MOVETODAILY);
			return;
		}
		mCurrentState.state = 1;
		Flush();
		setTimeout(function(){sForm.submit()}, WAIT_DODAILY);
	}else if(mCurrentState.state == 1)
		Done();
}
function playDesertedTomb(){
	if(mCurrentState.state == 0){
		var sForm = $("form[action='/worlds/geraptiku/tomb.phtml']");
		if(sForm.length == 0){
			Log("Moving to Deserted Tomb.");
			setTimeout(function(){
				window.location = "http://www.neopets.com/worlds/geraptiku/tomb.phtml";
			}, WAIT_MOVETODAILY);
			return;
		}
		if($("input[name='opened']").val() != 1){
			Log("It's not open?");
			return;
		}
		mCurrentState.state = 1;
		Flush();
		setTimeout(function(){sForm.submit()}, WAIT_DODAILY);
	}else if(mCurrentState.state == 1){
		Log("Continuing into tomb.");
		var sForm = $("form[action='/worlds/geraptiku/process_tomb.phtml']");
		mCurrentState.state = 2;
		Flush();
		if(sForm.length == 1) setTimeout(function(){sForm.submit()}, WAIT_DODAILY);
	}else if(mCurrentState.state == 2)
		Done();
}
function playTombola(pGoto){
	if(mCurrentState.state == 0){
		var sForm = $('form[action="tombola2.phtml"]');
		if(sForm.length == 0)
		{
			Log("Moving to Tombola.");
			setTimeout(function(){
				window.location = "http://www.neopets.com/island/tombola.phtml";
			},WAIT_MOVETODAILY);
			return;
		}
		mCurrentState.state = 1;
		Flush();
		setTimeout(function(){sForm.submit()}, WAIT_DODAILY);
	}else
		Done();
	
}
///Not complete, not functional.
function SpinWheel(){
	$.ajax("http://www.neopets.com/amfphp/gateway.php",
	{  
		data: "Wheelservice.spinWheel",
		success: function(html){
			console.log(html)
		}
	});
}
function UpdateShopPrices(){
	if(mCurrentState.currentPage == -1){
		Log("Going to last page to encourage consistency.");
		mCurrentState.currentPage = GetPagesInShop() - 1;
		Flush();
		setTimeout(function(){
			if(!mStopped)
				GotoPageInShop(mCurrentState.currentPage);
		}, WAIT_SHOPMOVE);
		return;
	}
	if(mCurrentState.state == mShopUpdateStates.Updating){
		var ItemsOnPage = GetItemsInShopCurrentPage();
		for(sVar in ItemsOnPage){
			var sItemShopIndex = new Number(sVar) + 1;
			var sItem = ItemsOnPage[sVar];
			var sNewItems = mCurrentState.itemsWithPrices.filter(function(e){
				return e.itemName == sItem.itemName;
			});
			if(sNewItems.length <= 0){
				Log("Couldn't find item:" + sItem.itemName + ".  Continuing.");
				continue;
			}
			var sNewItem = sNewItems[0];
			Log("Item: " + sItem.itemName + " Index: " + sItemShopIndex + " New Price: " + sNewItem.newPrice);
			if(sNewItem.newPrice == null) sNewItem.newPrice = 0;
			$("input[name='cost_"+sItemShopIndex+"']").val(sNewItem.newPrice);
		}
		mCurrentState.state = mShopUpdateStates.DoneUpdatingPage;
		Flush();
		setTimeout(function(){$('form[action="process_market.phtml"]').submit()}, WAIT_SHOPUPDATE);
	}else if(mCurrentState.state == mShopUpdateStates.DoneUpdatingPage && mCurrentState.currentPage > 0){
		Log("Continuing to next page.");
		if($(".errormess").length > 0)
			Log("There was an error while updating the prices:" + $(".errormess > div.errormess").text());
			
		mCurrentState.currentPage = mCurrentState.currentPage - 1;
		mCurrentState.state = mShopUpdateStates.Updating;
		Flush();
		setTimeout(function(){
			if(!mStopped)
				GotoPageInShop(mCurrentState.currentPage);
		}, WAIT_SHOPMOVE);
		return;
	}else
		Done();
}
function GetAveragePrices(){
	if(mCurrentState.currentItem < mCurrentState.itemsToCheck.length){
		if(mCurrentState.state == mShopWizardStates.None || mCurrentState.state == null){
			var sCurrentItem = mCurrentState.itemsToCheck[mCurrentState.currentItem];
			$("input[name=shopwizard]").val(sCurrentItem.itemName);
			mCurrentState.state = mShopWizardStates.Searching;
			Flush();
			Log("Searching shop wizard for:" + sCurrentItem.itemName);
			$("select[name='criteria']").val("exact");
			$("form[action='market.phtml']").unbind('submit');
			setTimeout(function(){$("form[action='market.phtml']").submit();}, WAIT_SHOPWIZARD);
			return;
		}else if(mCurrentState.state == mShopWizardStates.Searching){
			Log("Getting average price.");
			var sCurrentItem = mCurrentState.itemsToCheck[mCurrentState.currentItem];
			var sPrices = [];
			var sTable = $("table[align='center']");
			
			if($("span[style='font-size: 14pt;']").text() != sCurrentItem.itemName){
				Log("Shop wizard returned wrong item. :< We're looking for: " + sCurrentItem.itemName + ".");
				mCurrentState.state = mShopWizardStates.None;
				Flush();
				setTimeout((function(){
					if(!mStopped)
						window.location = "http://www.neopets.com/market.phtml?type=wizard";
				}), WAIT_SHOPWIZARD_RETRY);
				return;
			}
			
			if(sTable.length == 2){
				$(sTable[1]).find("tbody > tr").map(function(i,e){
					if(i == 0) return;
					var sPriceEntry = $(e);
					var sPrice = sPriceEntry.find("td[align=right]").text();
					sPrice = sPrice.substr(0,sPrice.length-3).replace(",","");
					sPrices.push(new Number(sPrice));
				});
				var sAverage = Avg(sPrices);
				Log("Average Price: " + sAverage);
				sCurrentItem.averagePrice = sAverage;
				sCurrentItem.newPrice = Math.round((1 - Math.random() * .05) * sAverage);
				Log("Going with the price of:" + sCurrentItem.newPrice);
				
				mCurrentState.itemsToCheck[mCurrentState.currentItem] = sCurrentItem;
				mCurrentState.currentItem = mCurrentState.currentItem + 1;
				mCurrentState.state = mShopWizardStates.None;
				
				Flush();
				Log("Continuing to next item.");
				setTimeout((function(){
					if(!mStopped)
						window.location = "http://www.neopets.com/market.phtml?type=wizard";
				}), WAIT_SHOPWIZARD);
			}else{
				Log("Couldn't find a good price for: " + sCurrentItem.itemName + ". :<");
				sCurrentItem.newPrice = 0;
				mCurrentState.currentItem = mCurrentState.currentItem + 1;
				Flush();
				Log("Continuing to next item.");
				setTimeout((function(){
					if(!mStopped)
						window.location = "http://www.neopets.com/market.phtml?type=wizard";
				}), WAIT_SHOPWIZARD);
			}
		}
	}else{
		Log("Went through every item.");
		var sCurrentState = mCurrentState;
		mCurrentState = mStates.updatingItemsInShop;
		mCurrentState.itemsWithPrices = sCurrentState.itemsToCheck;
		Log("Going to update shop prices.");
		Flush();
		setTimeout(function(){
			if(!mStopped)
				window.location = "http://neopets.com/market.phtml?type=your";
		}, WAIT_SHOPTRANSITION);
	}
}
function Wonder(){
	if(mStopped)
		return;
	var sAvailable = GetAvailableLinks();
	var sLinkIndex = Math.round(Math.random()*sAvailable.length);
	Log("Wondering to:", sAvailable[sLinkIndex]);
	mCurrentState.readyToChange = 1;
	setTimeout(function(){
		window.location = sAvailable[sLinkIndex];
	}, WAIT_WONDER);
}
function GetAvailableLinks(){return $("a[href^='/']").map((function(i,e){ return e.href; }));}
function GetItemsInShop(){
	if(mCurrentState.status != "gettingItemsInShop"){
		Log("Starting to get items in shop.");
		mCurrentState = mStates.gettingItemsInShop;
		Flush();
		setTimeout(function(){
			if(!mStopped)
				window.location = "http://neopets.com/market.phtml?type=your";
		}, WAIT_SHOPTRANSITION);
		Log("Done.");
		return;
	}
	if(mCurrentState.currentPage < GetPagesInShop()){
		Log("Getting items in shop.");
		var sCurrentItems = GetItemsInShopCurrentPage().filter(function(e){ return e.itemOldPrice == 0; });;
		for(sVar in sCurrentItems)
			mCurrentState.itemsInShop.push(sCurrentItems[sVar]);
		mCurrentState.currentPage = mCurrentState.currentPage + 1;
		Flush();
		if(mCurrentState.currentPage < GetPagesInShop()){
			Log("Changing Pages to " + mCurrentState.currentPage + ".");
			setTimeout((function(){
				if(!mStopped)
					GotoPageInShop(mCurrentState.currentPage);
			}), WAIT_SHOPUPDATE)
			return;
		}else
		{
			var sCurrentState = mCurrentState;
			mCurrentState = mStates.gettingAveragePrice;
			mCurrentState.itemsToCheck = sCurrentState.itemsInShop;
			Flush();
			Log("Done getting items.  Changing to shop wizard.");
			setTimeout((function(){
				if(!mStopped)
					window.location = "http://www.neopets.com/market.phtml?type=wizard";
			}), WAIT_SHOPTRANSITION);
			return;
		}
	}
}
function AppendSidebarModule(pTitle, pContent){
	var sElement = '<div class="sidebarModule"><table width="158" cellpadding="2" cellspacing="0" border="0" class="sidebarTable"><tbody><tr><td valign="middle" class="sidebarHeader medText">'+pTitle+'</td></tr><tr><td>'+pContent+'</td></tr></tbody></table></div>';
	$(".sidebar").append(sElement);
}
function GetItemsInShopCurrentPage(){
	var sItems = [];
	var sTRItems = $("form[action='process_market.phtml'] > table > tbody> tr");
	sTRItems.each((function(i,e){ 
		if(i == 0 || i == sTRItems.length-1) return; 
		var sChildren = $(e).children();
		var sItem = { /// We could return the index, but it's better we don't, since it can change.
			itemName: $(sChildren[0]).text(),
			itemID: sChildren[4].value,
			itemOldPrice: sChildren[5].value
		};
		sItems.push(sItem);
		Log("Item: " + sItem.itemName);
	}));
	return sItems;
}
function GetPagesInShop(){
	var amnt = $("center > a[href^='market.phtml?order_by=id&type=your&lim=']").length;
	if(amnt <= 0) amnt = 1;
	return amnt;
}
function IsInventoryPage(){return $("input[name=type][value=inventory]").length == 1;}
function GotoPageInShop(pPage){window.location = "http://www.neopets.com/market.phtml?order_by=id&type=your&lim=" + ((pPage + 1)*30);}
Main();