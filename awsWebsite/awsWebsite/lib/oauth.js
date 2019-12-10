var oauth2orize = require('oauth2orize');
var OAuth = require('../models/oauth');

var server = oauth2orize.createServer();
const expires_in = 60*60*24*7; // Measured in seconds

server.grant(oauth2orize.grant.code({
	scopeSeparator: [ ' ', ',' ]
}, function(application, redirectURI, user, ares, done) {
	console.log("grant user: ", user.username);
	OAuth.GrantCode.findOne({application: application, user: user},function(error,grant){
		if (!error && grant) {
			done(null,grant.code);
		} else if (!error) {
			var grant = new OAuth.GrantCode({
				application: application,
				user: user,
				scope: ares.scope
			});
			grant.save(function(error) {
				done(error, error ? null : grant.code);
			});
		} else {
			done(error,null);
		}
	});

	// var grant = new OAuth.GrantCode({
	// 	application: application,
	// 	user: user,
	// 	scope: ares.scope
	// });
	// grant.save(function(error) {
	// 	done(error, error ? null : grant.code);
	// });
}));

server.exchange(oauth2orize.exchange.code({
	userProperty: 'appl'
}, function(application, code, redirectURI, done) {
	OAuth.GrantCode.findOne({ code: code }, function(error, grant) {
		if (grant && grant.active && grant.application == application.id) {
			var now = (new Date().getTime());
			OAuth.AccessToken.findOne({application:application, user: grant.user, expires: {$gt: now}}, function(error,token){
				console.log("Token: ", token);
				if (token) {
					OAuth.RefreshToken.findOne({application:application, user: grant.user},function(error, refreshToken){
						if (refreshToken){
							var expires = Math.round((token.expires - (new Date().getTime()))/1000);
							expires = ( expires < expires_in ? expires : expires_in );
							done(null,token.token, refreshToken.token,{token_type: 'Bearer', expires_in: expires});
							var today = new Date();
							token.expires = new Date(today.getTime() + ( expires < expires_in ? expires : expires_in ) * 1000);
							token.save();
							console.log("sent expires_in: ", expires, token.expires);
						} else {
							done(error);
						}
					});
				} else if (!error) {
					var today = new Date();
					var token = new OAuth.AccessToken({
						application: grant.application,
						user: grant.user,
						grant: grant,
						scope: grant.scope,
						expires: new Date(today.getTime() + expires_in * 1000)
					});

					token.save(function(error){
						var expires = Math.round((token.expires - (new Date().getTime()))/1000);
						// console.log("Expires-4: ", expires);
						//delete old refreshToken or reuse?
						OAuth.RefreshToken.findOne({application:application, user: grant.user},function(error, refreshToken){
							if (refreshToken) {
								done(error, error ? null : token.token, refreshToken.token, error ? null : { token_type: 'Bearer', expires_in: expires, scope: token.scope});
							} else if (!error) {
								var refreshToken = new OAuth.RefreshToken({
									user: grant.user,
									application: grant.application
								});

								refreshToken.save(function(error){
									done(error, error ? null : token.token, refreshToken.token, error ? null : { token_type: 'Bearer', expires_in: expires, scope: token.scope });
								});
							} else {
								done(error);
							}
						});
					});
				} else {
					done(error);
				}
			});

		} else {
			done(error, false);
		}
	});
}));

server.exchange(oauth2orize.exchange.refreshToken({
	userProperty: 'appl'
}, function(application, token, scope, done){
	console.log("Refresh!");
	OAuth.RefreshToken.findOne({token: token}, function(error, refresh){
		if (refresh && refresh.application == application.id) {
			OAuth.GrantCode.findOne({},function(error, grant){
				if (grant && grant.active && grant.application == application.id){
					var today = new Date();
					var newToken = new OAuth.AccessToken({
						application: refresh.application,
						user: refresh.user,
						grant: grant,
						scope: grant.scope,
						expires: new Date(today.getTime() + expires_in * 1000)
					});

					newToken.save(function(error){
						// console.log("Expires: ", newToken.expires);
						var expires = Math.round((newToken.expires - (new Date().getTime()))/1000);
						// console.log("Expires-1: ", expires);
						if (!error) {
							done(null, newToken.token, refresh.token, {token_type: 'Bearer', expires_in: expires, scope: newToken.scope});
						} else {
							done(error,false);
						}
					});
				} else {
					done(error,null);
				}
			});
		} else {
			done(error, false);
		}
	});
}));

server.serializeClient(function(application, done) {
	done(null, application.id);
});

server.deserializeClient(function(id, done) {
	OAuth.Application.findById(id, function(error, application) {
		done(error, error ? null : application);
	});
});

module.exports = server;
