var express = require('express');
var async = require('async');
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

//코디하기 메인화면 (한꺼번에 모든 의뢰글들 볼 수 있도록)
router.get('/',function(req,res,next){
  pool.getConnection(function(error, connection){
    if (error){
      console.log("getConnection Error" + error);
      res.sendStatus(500);
    }
    else {
        connection.query('select ask.id, profile_nickname, profile_image, contents, cloth_image, reply from ask, profile where user_nickname = profile_nickname COLLATE utf8_unicode_ci order by ask.id desc',function(error, result){
          if (error){
            console.log("getConnection Error" + error);
            res.sendStatus(500);
          }
          else {
            res.status(200).send({result : result});
            connection.release();
          }
        });
    }
  });
});

//사용자가 쓴 모든 의뢰글들 보여주기(한꺼번에 전송)
router.get('/posts/:user_id', function(req, res, next){
  pool.getConnection(function(error, connection){
    if (error){
      console.log("getConnection Error" + error);
      res.sendStatus(500);
    }
    else {
      var sql ='select ask.id, profile_nickname, profile_image, contents, cloth_image, reply from ask, profile where user_nickname = profile_nickname COLLATE utf8_unicode_ci and user_id = ? order by ask.id desc';
      connection.query(sql, [req.params.user_id], function(error, result){
        if (error){
          console.log("getConnection Error" + error);
          res.sendStatus(500);
        }
        else {
          res.status(200).send({result : result});
          connection.release();
        }
      });
    }
  });
});


//의뢰글에 달린 코디글들 보기(한꺼번에 전송)
router.get('/:id', function(req, res, next){
  pool.getConnection(function(error, connection){
    if (error){
      console.log("getConnection Error" + error);
      res.sendStatus(500);
    }
    else{ //코디글 쓴 사람 정보 select
      var sql = 'select codi.id,profile_nickname,profile_image,contents,like_num,image1,image2,image3,image4,image5,image6 from codi,profile where profile_nickname = codi COLLATE utf8_unicode_ci and ask_id=? order by id desc';
      connection.query(sql, [req.params.id], function(error, codi) {
        if (error){
          console.log("Connection Error" + error);
          res.sendStatus(500);
        }
        else {
                var id = 'id';
                var profile_nickname = 'profile_nickname';
                var profile_image = 'profile_image';
                var contents = 'contents';
                var like_num = 'like_num';
                var codi_images = 'codi_images';
                var result = new Object([]);
                for(var i = 0; i<codi.length; i++){
                  var one = new Object({});
                  var image_array = new Object([]);
                  image_array.push(codi[i].image1);
                  image_array.push(codi[i].image2);
                  image_array.push(codi[i].image3);
                  image_array.push(codi[i].image4);
                  image_array.push(codi[i].image5);
                  image_array.push(codi[i].image6);
                  one[id] = codi[i].id;
                  one[profile_nickname] = codi[i].profile_nickname;
                  one[profile_image] = codi[i].profile_image;
                  one[contents] = codi[i].contents;
                  one[like_num] = codi[i].like_num;
                  one[codi_images] = image_array;
                  result.push(one);
              }
              res.status(200).send({result : result});
              connection.release();
          }
      });
    }
  });
});



//의뢰글 쓸 때 옷장 보여주기(complete)
router.get('/closet/:user_id/:category', function(req, res, next) {
  pool.getConnection(function(error, connection){
    if (error){
      console.log("getConnection Error" + error);
      res.sendStatus(500);
    }
    else { //사용자 옷장에 있는 옷들 select
      connection.query('select * from closet where cloth_owner_id = ? and category = ?', [req.params.user_id, req.params.category], function(error, rows) {
        if (error){
          console.log("Connection Error" + error);
          res.sendStatus(500);
          connection.release();
        }
        else {
          res.status(200).send({closet : rows}); // { } 로 구성된 객체배열
          connection.release();
        }
      });
    }
  });
});


//코디 의뢰글 작성 완료 (complete)
router.post('/:user_id', function(req, res, next) {
  pool.getConnection(function(error, connection){
    if (error){
      console.log("getConnection Error" + error);
      res.sendStatus(500);
    }
    else {
      connection.query('select nickname from user where id = ?', [req.body.user_id], function(error, result){
        if (error){
          console.log("getConnection Error" + error);
          res.sendStatus(500);
        }
        else {
          sql = 'insert into ask(user_id, user_nickname, contents, cloth_image, reply) values(?,?,?,?,?)';
          insert = [req.body.user_id, result[0].nickname, req.body.contents, req.body.cloth_image, 0];
            //image는 이미지url
          connection.query(sql, insert, function(error, rows) {
            if (error){
             console.log("Connection Error" + error);
             res.sendStatus(500);
             connection.release();
            }
            else {
            res.status(200).send({message : 'done'});
            connection.release();
            }
          });
        }
      });
    }
  });
});


module.exports = router;
