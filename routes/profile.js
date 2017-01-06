var express = require('express');
var mysql = require('mysql');
var aws = require('aws-sdk');
var urlencode = require('urlencode');
var iconv  = require('iconv-lite');
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


//프로필 상세조회(닉넴, 이미지, 상메, 랭킹, 의뢰글 수, 코디글 수)
router.get('/:user_id', function(req, res, next){
  pool.getConnection(function(error, connection){
    if (error){
      console.log("getConnection Error" + error);
      res.sendStatus(500);
    }
    else {
        connection.query('select nickname, email_address from user where id = ?', [req.params.user_id], function(error, info){
          if (error){
            console.log("getConnection Error" + error);
            res.sendStatus(500);
          }
          else {
            var who = info[0].nickname;
            connection.query('select count(*) from codi where codi = ?', who, function(error, codi_num){
              if (error){  //사용자가 쓴 코디글 수 select
                 console.log("Connection Error" + error);
                 res.sendStatus(500);
              }
              else {
                connection.query('select count(*) from ask where user_nickname = ?', who, function(error,ask_num){
                  if(error){ //사용자가 쓴 의뢰글 수 select
                    console.log("connection error" + error);
                    res.sendStatus(500);
                  }
                  else {
                    connection.query('select id as profile_id, profile_nickname, profile_image, profile_message from profile where profile_nickname = ?', who, function(error, profile){
                      if(error){  //닉넴, 프로필이미지, 메세지 select
                        console.log("connection error" + error);
                        res.sendStatus(500);
                      }
                      else{
                        var sql = 'SELECT codi, status, @Rank:=@Rank + 1 AS user_rank FROM(SELECT codi, sum(like_num) AS status FROM codi GROUP BY codi ORDER BY status DESC)Sub1 CROSS JOIN (SELECT @Rank:=0)Sub2';
                        connection.query(sql, function(error, rank_info){ //전체 랭킹 select
                          if(error){
                            console.log("connection error" + error);
                            res.sendStatus(500);
                          }
                          else {
                            var r;
                            for(var i = 0; i<rank_info.length; i++){
                              if(rank_info[i].codi==who) {
                                r = rank_info[i].user_rank;
                                break;
                              }
                              else r = 0;
                            }
                                var key1, key2, user_id, email_address;
                                var result = profile[0];
                                 user_id = 'user_id';
                                 key1 = 'codi_num';
                                 key2 = 'ask_num';
                                 rank = 'rank';
                                email_address='email_address';
                                result[email_address]=info[0].email_address;
                                result[user_id] = profile[0].profile_id;
                                result[key1] = codi_num[0]['count(*)'];
                                result[key2] = ask_num[0]['count(*)'];
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
        });
    }
  });
});


//프로필 수정 전 닉네임 중복체크
router.post('/edit', function(req, res, next){
  pool.getConnection(function(error, connection){
    var exist = false;
    if (error){
      console.log("getConnection Error" + error);
      res.sendStatus(500);
    }
    else {
      connection.query('select * from profile',function(error, cursor){
          if(error) {
            console.log("getConnection Error" + error);
            res.sendStatus(500);
          }
          else {
            for(var i=0; i<cursor.length; i++){
                if(cursor[i].profile_nickname==req.body.new_nickname){ //닉네임이 같은데
                  if(cursor[i].id!=req.body.id){ //같은 프로필도 아니면
                     exist = true;
                  }
                }
            } // 응답 시 utf-8 로 인코딩해줘야 한다.
            if(exist){
              res.status(200).send({message:'not usable'});
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

//프로필 수정 완료
router.post('/edit_complete', upload.single('file'), function(req, res, next){
  pool.getConnection(function(error, connection){
    if (error){
      console.log("getConnection Error" + error);
      res.sendStatus(500);
    }
    else {
      var sql, insert;
      if(req.file){
        sql = 'update profile set profile_nickname = ?, profile_image = ?, profile_message = ? where id = ?';
        insert = [req.body.new_nickname, req.file.location, req.body.new_message, req.body.id];
      }
      else {
        sql = 'update profile set profile_nickname = ?, profile_message = ? where id = ?';
        insert = [req.body.new_nickname, req.body.new_message, req.body.id];
      } //프로필 이미지, 닉넴 변경
      connection.query(sql, insert, function(error, rows){
        if (error){
          console.log("getConnection Error" + error);
          res.sendStatus(500);
        }
        else { //user 테이블에 있는 사용자 닉넴도 변경
          connection.query('update user set nickname = ? where id = ?',[req.body.new_nickname,req.body.id],function(error,rows){
            if(error){
              console.log("getConnection Error" + error);
              res.sendStatus(500);
            }
            else { //의뢰글 테이블에서 사용자가 쓴 글의 닉넴도 변경
              connection.query('update ask set user_nickname=? where user_id = ?',[req.body.new_nickname,req.body.id],function(error,rows){
                if(error){
                  console.log("getConnection Error" + error);
                  res.sendStatus(500);
                }
                else { //코디글 테이블에서 사용자가 쓴 의뢰글의 닉넴 변경
                  connection.query('update codi set asker = ? where asker_id = ?',[req.body.new_nickname,req.body.id],function(error,rows){
                    if(error){
                      console.log("getConnection Error" + error);
                      res.sendStatus(500);
                    }
                    else { //코디글에서 사용자가 쓴 코디글 닉넴 변경
                      connection.query('update codi set codi = ? where codi_id = ?',[req.body.new_nickname,req.body.id],function(error,rows){
                        if(error){
                          console.log("getConnection Error" + error);
                          res.sendStatus(500);
                        }
                        else {
                          res.status(200).send({message:'done'});
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
    }
  });
});

module.exports = router;
