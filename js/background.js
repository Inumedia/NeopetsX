(function(){
	var sRewrites = [
		{
			to: "/useobject\\.phtml", 
			from: "http://www.neopets.com/iteminfo.phtml"
		},
		{
			to: "/market\\.phtml", 
			from: "http://www.neopets.com/market.phtml?type=wizard"
		}];
	var requestFilter = {
		urls: ["<all_urls>"]//sRewrites.map(function(pEntry){ return "http://www.neopets.com" + pEntry.to.replace("\\", ""); })
	},
		extraInfoSpec = ['requestHeaders', 'blocking'],
		handler = function(pDetails){
			var headers = pDetails.requestHeaders,
				blockingResponse = {};
			for(var i = 0; i < headers.length; ++i){
				console.log(headers[i].name, headers[i].value);
				if(headers[i].name == "Referer"){
					for(var ii = 0; ii < sRewrites.length; ++ii){
						var sRewrite = sRewrites[ii];
						console.log(pDetails, sRewrite);
						if(pDetails.url.match(sRewrite.to)){
							console.log(headers[i].value, "Rewriting to ", sRewrite.from);
							headers[i].value = sRewrite.from;
							break;
						}
					}
					break;
				}
			}	
			blockingResponse.requestHeaders = headers;
			return blockingResponse;
		}
	chrome.webRequest.onBeforeSendHeaders.addListener(handler, requestFilter, extraInfoSpec);
	console.log("Ohai.", requestFilter);
})();