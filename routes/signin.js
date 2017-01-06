var express = require('express');
var mysql = require('mysql');
var aws = require('aws-sdk');
var multer = require('multer');
var multerS3 = require('multer-s3');
var router = express.Router();

var pool = mysql.createPool({
  host : db_config.host,
  port : db_config.port,
  user : db_config.user,
  password : db_config.password,
  database : db_config.database,
  connectionLimit : db_config.connectionLimit
});


//닉네임 중복체크
router.post('/',function(req, res, next) {
  var exist = false;
    pool.getConnection(function(error, connection){
      if(error){
        console.log("getConnection Error" + error);
        res.sendStatus(500);
      }
      else {
           connection.query('select * from user',function(error, cursor){
               if(error) {
                 console.log("getConnection Error" + error);
                 res.sendStatus(500);
                 connection.release();
               }
               else {
                 for(var i=0; i<cursor.length; i++){
                     if(cursor[i].nickname==req.body.nickname){
                          exist = true;
                     }
                 }
                 if(exist){
                   res.status(500).send({message:'not usable'});
                   connection.release();
                 }
                 else {
                   res.status(200).send({message: 'usable'});
                   connection.release();
                 }

               }
           });
      }
    });
});

//회원가입 완료
router.post('/complete', function(req,res,next){
  pool.getConnection(function(error, connection){
    if (error){
      console.log("getConnection Error" + error);
      res.sendStatus(500);
    }
    else {
      console.log(req.body);
      var sql = 'insert into user(email_address, nickname, gender) values(?,?,?)';
      var insert = [req.body.email_address, req.body.nickname, req.body.gender];
      connection.query(sql, insert, function(error, rows){
        if (error){
           console.log("Connection Error" + error);
           res.sendStatus(500);
        }
        else {
          connection.query('select id from user where email_address = ?', [req.body.email_address],function(error,result){
            if (error){
               console.log("Connection Error" + error);
               res.sendStatus(500);
            }
            else{
              connection.query('insert into profile(id, profile_nickname, profile_image, profile_message) values(?,?,?,?)', [result[0].id,req.body.nickname,null,null], function(error, result){
                if (error){
                   console.log("Connection Error" + error);
                   res.sendStatus(500);
                }
                else{
                  connection.query('select user.id as user_id, profile.id as profile_id from user,profile where profile_nickname = nickname COLLATE utf8_unicode_ci and nickname = ?',[req.body.nickname], function(error, count){
                    if (error){
                       console.log("Connection Error" + error);
                       res.sendStatus(500);
                    }
                    else {
                      var user_profile = new Object({});
                      user_profile.user_id = count[0].user_id;
                      user_profile.profile_id = count[0].profile_id;
                      user_profile.profile_nickname =  req.body.nickname;
                      user_profile.profile_image = null;
                      user_profile.profile_message = null;
                      user_profile.rank = 0;
                      user_profile.ask_num = 0;
                      user_profile.codi_num = 0;
                      res.status(200).send({user_profile : user_profile});
                      connection.release();
                    }
                  });
                }
              });
            }
          });

        }
    });
}
});
});



//재 로그인
router.get('/login_again/:email_address', function(req, res, next){
    var exist = false;
    var user = {};
  pool.getConnection(function(error, connection){
    if (error){
      console.log("getConnection Error" + error);
      res.sendStatus(500);
    }
    else {
      connection.query('select * from user where email_address = ?', [req.params.email_address], function(error, result){
        if(error){
          console.log("getConnection Error" + error);
          res.sendStatus(500);
        }
        else {
          if(result.length===0){
            res.status(200).send({message : 'not exist'});
            connection.release();
          }
          else {
            var nick = result[0].nickname;
            var user_id = result[0].id;
            connection.query('select count(*) from codi where codi = ?', result[0].nickname, function(error, codi_num){
              if (error){  //사용자가 쓴 코디글 수 select
                 console.log("Connection Error" + error);
                 res.sendStatus(500);
              }
              else {
                connection.query('select count(*) from ask where user_nickname = ?', result[0].nickname, function(error,ask_num){
                  if(error){ //사용자가 쓴 의뢰글 수 select
                    console.log("connection error" + error);
                    res.sendStatus(500);
                  }
                  else {
                    connection.query('select id as profile_id, profile_nickname,profile_image,profile_message from profile where profile_nickname = ?', result[0].nickname, function(error, profile){
                      if(error){  //각 사용자들의 닉네임, 코디글의 좋아요 수의 합 select
                        console.log("connection error" + error);
                        res.sendStatus(500);
                      }
                      else{
                        var sql = 'SELECT codi, status, @Rank:=@Rank + 1 AS user_rank FROM(SELECT codi, sum(like_num) AS status FROM codi GROUP BY codi ORDER BY status DESC)Sub1 CROSS JOIN (SELECT @Rank:=0)Sub2';
                        connection.query(sql, function(error, rank_info){
                          if(error){
                            console.log("connection error" + error);
                            res.sendStatus(500);
                          }
                          else {
                            var r;
                            for(var i = 0; i<rank_info.length; i++){
                              if(rank_info[i].codi==nick) {
                                r = rank_info[i].user_rank;
                                break;
                              }
                              else r = 0;
                            }
                                var key1, key2,value1, value2;
                                var result = profile[0];
                                 key1 = 'codi_num';
                                 key2 = 'ask_num';
                                 key3 = 'user_id';
                                 rank = 'rank';
                                result[key1] = codi_num[0]['count(*)'];
                                result[key2] = ask_num[0]['count(*)'];
                                result[key3] = user_id;
                                result[rank] = r;
                                res.status(200).send({user_profile : result});
                                connection.release();
                          }
                        });
                      }
                    });
                  }
                });
              }
            });
          }
        }
      });
    }
  });
});

module.exports = router;
