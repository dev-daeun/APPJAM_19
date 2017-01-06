var express = require('express');
var mysql = require('mysql');
var async = require('async');
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

//user_id가 작성한 모든 코디글들 보여주기(한꺼번에 전송)
router.get('/posts/:user_id', function(req, res, next){
  pool.getConnection(function(error, connection){
    if (error){
      console.log("getConnection Error" + error);
      res.sendStatus(500);
    }
    else {
      var sql = 'select codi.id,profile_nickname,profile_image,contents,image1,image2,image3,image4,image5,image6,like_num from codi,profile where profile_nickname = codi COLLATE utf8_unicode_ci and codi_id=? order by id desc';
      connection.query(sql, [req.params.user_id], function(error, codi){
        if (error){
          console.log("getConnection Error" + error);
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



//코디글 작성 시 의뢰자의 옷장 보여주기
router.get('/closet/:ask_id/:category', function(req, res, next){
  pool.getConnection(function(error, connection){
    if (error){
      console.log("getConnection Error" + error);
      res.sendStatus(500);
    }
    else {
      connection.query('select * from ask where id = ?', [req.params.ask_id], function(error, rows){
        if (error){
          console.log("getConnection Error" + error);
          res.sendStatus(500);
        }
        else {
          connection.query('select * from closet where cloth_owner_id = ? and category = ?',[rows[0].user_id,req.params.category], function(error, rows2){
            if (error){
              console.log("getConnection Error" + error);
              res.sendStatus(500);
            }
            else {
              res.status(200).send({closet : rows2});
              connection.release();
            }
          });
        }

      });
    }
  });
});

//코디글 저장
router.post('/',function(req,res,next){
  pool.getConnection(function(error, connection){
    if (error){
      console.log("getConnection Error" + error);
      res.sendStatus(500);
    }
    else {
      connection.query('select id from nickname where nickname = ?',[req.body.asker], function(error, result){
        if (error){
          console.log("getConnection Error" + error);
          res.sendStatus(500);
        }
        else {
          var asker_id = result[0].id;
          connection.query('select id from nickname wherer nickname = ?', [req.body.codi],function(error, result){
            if (error){
              console.log("getConnection Error" + error);
              res.sendStatus(500);
            }
            else {
              var codi_id = result[0].id;
              var sql = 'insert into codi(ask_id, asker, asker_id, codi, codi_id, contents, image1, image2, image3, image4, image5, image6, like_num) values(?,?,?,?,?,?,?,?,?,?,?)';
              var insert = [req.body.ask_id, req.body.asker, asker_id, req.body.codi, codi_id, req.body.contents, req.body.codi_images[0],req.body.codi_images[1],req.body.codi_images[2],req.body.codi_images[3],req.body.image5,req.body.image6, 0];
              connection.query(sql, insert, function(error, rows) {
                if (error){
                  console.log("Connection Error" + error);
                  res.sendStatus(500);
                }
                else {
                  //의뢰글에 달린 코디글 수 갱신
                  connection.query('update ask set reply = reply + 1 where id = ?', [req.body.ask_id], function(error, rows) {
                    if (error){
                      console.log("Connection Error" + error);
                      res.sendStatus(500);
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
        }
      });
    }
  });
});

//좋아요 눌렀을 때 좋아요 수 갱신
router.put('/like_update', function(req, res, next) {
    pool.getConnection(function(error, connection){
      if (error){
        console.log("Connection Error" + error);
        res.sendStatus(500);
      }
      else{
        if (req.body.toggle===true) {
              connection.query('update codi set like_num=like_num+1  where id = ?',[req.body.id], function(error, rows){ // URL 창이 header.
                  if(error){
                    console.log("Connection Error" + error);
                    res.sendStatus(500);
                  }
                  else{
                    connection.query('select like_num from codi where id = ?', [req.body.id], function(error, result) {
                        if (error){
                          console.log("Connection Error" + error);
                          res.sendStatus(500);
                        }
                        else{
                          res.status(201).send({result : result[0].like_num});
                          connection.release();
                        }
                    });
                  }
              }); // end of update codi set like_num = like_num+1
            //end of like_toggle === true
          }
            else if(req.body.toggle===false){ //like_toggle ===false
              connection.query('update codi set like_num=like_num-1 where id = ?',[req.body.id], function(error, rows){ // URL 창이 header.
                  if (error){
                    console.log("Connection Error" + error);
                    res.sendStatus(500);
                  }
                  else{
                      connection.query('select like_num from codi where id = ?', [req.body.id], function(error, result){
                        if (error){
                          console.log("Connection Error" + error);
                          res.sendStatus(500);
                        }
                        else{
                          res.status(201).send({result : result[0].like_num});
                          connection.release();
                        }
                      });
                  }
              });
            }//end of like_toggle ===false
      }
    });//end of pool.getConnection
}); // end of router.get

module.exports = router;
